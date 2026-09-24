#!/usr/bin/env bash
# Sobe todo o ambiente de desenvolvimento do VANT-Performance em um comando.
#
#   ./dev.sh          sobe tudo e segue os logs (Ctrl+C encerra os processos)
#   ./dev.sh stop     encerra os processos e derruba os containers
#   ./dev.sh status   mostra o estado de cada serviço
#
# Na primeira execução instala dependências, cria a venv do motor Python,
# aplica as migrations e roda o seed. Nas seguintes, apenas sobe.
set -uo pipefail

BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE="$BASE/apps/python-engine"
WEB="$BASE/apps/web"
LOGS="$BASE/storage/logs"
mkdir -p "$LOGS" "$BASE/storage/graphs"

RED=$'\e[31m'; GRN=$'\e[32m'; YEL=$'\e[33m'; BLU=$'\e[34m'; DIM=$'\e[2m'; OFF=$'\e[0m'
say()  { printf '%s>>%s %s\n' "$BLU" "$OFF" "$*"; }
ok()   { printf '%s ok%s %s\n' "$GRN" "$OFF" "$*"; }
warn() { printf '%s  !%s %s\n' "$YEL" "$OFF" "$*"; }
die()  { printf '%s ERRO%s %s\n' "$RED" "$OFF" "$*" >&2; exit 1; }

PIDS=()

# aguarda `cmd` devolver sucesso, ate `timeout` segundos
wait_for() {
  local nome="$1" timeout="$2"; shift 2
  local t=0
  until "$@" > /dev/null 2>&1; do
    t=$((t+1))
    [ "$t" -ge "$timeout" ] && return 1
    sleep 1
  done
  ok "$nome"
}

parar() {
  trap - INT TERM EXIT
  echo
  say "encerrando..."
  for pid in "${PIDS[@]:-}"; do
    [ -n "${pid:-}" ] && kill "$pid" 2>/dev/null
  done
  # os processos sobem filhos (next dev, tsx); encerra a arvore pelo padrao
  pkill -f 'uvicorn main:app --port 8000' 2>/dev/null
  pkill -f 'run-analysis.worker' 2>/dev/null
  pkill -f 'next dev' 2>/dev/null
  wait 2>/dev/null
  ok "processos encerrados (containers seguem no ar; use ./dev.sh stop)"
}

case "${1:-up}" in
  stop)
    say "encerrando processos e containers"
    pkill -f 'uvicorn main:app --port 8000' 2>/dev/null
    pkill -f 'run-analysis.worker' 2>/dev/null
    pkill -f 'next dev' 2>/dev/null
    (cd "$BASE" && docker compose down)
    ok "tudo parado"
    exit 0
    ;;
  status)
    docker compose -f "$BASE/docker-compose.yml" ps 2>/dev/null
    printf '\nmotor Python : '; curl -s -m 2 http://localhost:8000/health || echo "fora do ar"
    printf '\nNext.js      : '; curl -s -m 3 -o /dev/null -w 'HTTP %{http_code}' http://localhost:3000/login || echo "fora do ar"
    printf '\nworker       : '; pgrep -f 'run-analysis.worker' > /dev/null && echo "rodando" || echo "fora do ar"
    exit 0
    ;;
  up) ;;
  *) die "uso: ./dev.sh [up|stop|status]" ;;
esac

command -v docker > /dev/null || die "docker nao encontrado"
command -v node   > /dev/null || die "node nao encontrado"

# ---------------------------------------------------------------- 1. infra
say "subindo PostgreSQL e Redis"
(cd "$BASE" && docker compose up -d postgres redis) > /dev/null 2>&1 \
  || die "falha ao subir os containers"
wait_for "postgres pronto" 60 docker compose -f "$BASE/docker-compose.yml" exec -T postgres pg_isready -U vant \
  || die "postgres nao ficou pronto"
wait_for "redis pronto" 30 docker compose -f "$BASE/docker-compose.yml" exec -T redis redis-cli ping \
  || die "redis nao ficou pronto"

# ------------------------------------------------------- 2. motor de calculo
if [ ! -x "$ENGINE/.venv/bin/uvicorn" ]; then
  say "criando venv do motor Python (primeira execucao)"
  python3 -m venv "$ENGINE/.venv" || die "falha ao criar a venv"
  "$ENGINE/.venv/bin/pip" install -q -r "$ENGINE/requirements.txt" || die "falha ao instalar requirements"
fi

say "iniciando motor de calculo (:8000)"
( cd "$ENGINE" && GRAPHS_DIR="$BASE/storage/graphs" \
    .venv/bin/uvicorn main:app --port 8000 > "$LOGS/engine.log" 2>&1 ) &
PIDS+=($!)
wait_for "motor de calculo respondendo" 40 curl -sf http://localhost:8000/health \
  || { warn "motor nao respondeu; ultimas linhas:"; tail -15 "$LOGS/engine.log"; parar; exit 1; }

# ------------------------------------------------------------ 3. banco / web
if [ ! -d "$WEB/node_modules" ]; then
  say "instalando dependencias do web (primeira execucao)"
  (cd "$WEB" && npm install) || die "npm install falhou"
fi
[ -f "$WEB/.env" ] || { cp "$WEB/.env.example" "$WEB/.env"; warn ".env criado a partir do exemplo -- defina AUTH_SECRET"; }

say "aplicando migrations"
(cd "$WEB" && npx prisma migrate deploy) > "$LOGS/prisma.log" 2>&1 \
  || { warn "migrate deploy falhou; ver $LOGS/prisma.log"; tail -10 "$LOGS/prisma.log"; }

# seed apenas se o catalogo estiver vazio, para nao reprocessa-lo a cada subida.
# A consulta vai direto ao psql: `prisma db execute` exige --schema/--url e as
# tabelas usam nomes em snake_case (@@map no schema.prisma), nao o nome do modelo.
n_helices="$(docker compose -f "$BASE/docker-compose.yml" exec -T postgres \
  psql -U vant -d vant -tAc 'SELECT count(*) FROM propellers;' 2>/dev/null | tr -d '[:space:]')"
if [ -z "$n_helices" ] || [ "$n_helices" = "0" ]; then
  say "catalogo vazio: rodando seed"
  (cd "$WEB" && npm run db:seed) > "$LOGS/seed.log" 2>&1 && ok "seed aplicado" \
    || warn "seed falhou; ver $LOGS/seed.log"
else
  ok "catalogo ja populado ($n_helices helices) - seed dispensado"
fi

say "iniciando Next.js (:3000)"
( cd "$WEB" && npm run dev > "$LOGS/web.log" 2>&1 ) &
PIDS+=($!)

say "iniciando worker de analises"
( cd "$WEB" && npm run worker > "$LOGS/worker.log" 2>&1 ) &
PIDS+=($!)

trap parar INT TERM EXIT

wait_for "Next.js respondendo" 90 curl -sf -o /dev/null http://localhost:3000/login \
  || { warn "Next.js nao respondeu; ultimas linhas:"; tail -15 "$LOGS/web.log"; }

cat <<EOF

  ${GRN}ambiente no ar${OFF}

    aplicacao      http://localhost:3000
    motor          http://localhost:8000/health
    documentacao   http://localhost:8000/docs

    login          breno@vant.local / senha1234
    admin          admin@vant.local / admin12345

  ${DIM}logs em storage/logs/ - Ctrl+C encerra os processos${OFF}

EOF

# segue os logs dos tres servicos com prefixo, ate Ctrl+C
tail -n 0 -F "$LOGS/engine.log" "$LOGS/web.log" "$LOGS/worker.log" 2>/dev/null |
  awk -v d="$DIM" -v o="$OFF" '
    /^==> .*engine\.log/ { p=d "[motor] " o; next }
    /^==> .*web\.log/    { p=d "[web]   " o; next }
    /^==> .*worker\.log/ { p=d "[work]  " o; next }
    /^==>/               { next }
    NF                   { print p $0; fflush() }'
