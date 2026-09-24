# VANT-Performance

Aplicação web para análise preliminar de desempenho de veículos aéreos não tripulados (VANTs) de asa fixa com propulsão elétrica.

## Componentes

- `apps/web`: aplicação Next.js 15 com frontend React, API REST, autenticação Auth.js, banco PostgreSQL via Prisma e filas de análise com BullMQ/Redis.
- `apps/python-engine`: microserviço FastAPI para cálculos de desempenho e geração de gráficos com Matplotlib.
- `apps/python-engine/data/propellers`: curvas de hélices usadas pelo motor de cálculo.
- `storage/graphs`: diretório local para os gráficos gerados durante as análises.

## Requisitos

- Docker Engine 24+ e Docker Compose (`docker compose`);
- Node.js 20 LTS+ e npm;
- Python 3.11+ para rodar o motor fora de Docker (a imagem usa Python 3.12);
- Linux, macOS ou Windows com WSL2.

## Início rápido

Na raiz do projeto, execute:

```bash
./dev.sh
```

Na primeira execução, o script sobe PostgreSQL 16 e Redis 7, cria o ambiente virtual Python, instala as dependências, aplica as migrations e carrega os dados iniciais. O arquivo `apps/web/.env` é criado a partir de `.env.example`. Preencha `AUTH_SECRET` com um valor gerado localmente:

```bash
openssl rand -base64 32
```

A aplicação fica disponível em <http://localhost:3000> e a documentação do motor em <http://localhost:8000/docs>.

Comandos adicionais:

```bash
./dev.sh status  # mostra o estado dos serviços
./dev.sh stop    # encerra os processos e containers
```

O seed cria uma conta administrativa local para desenvolvimento: `admin@vant.local` / `admin12345`. Não use essa senha em ambientes compartilhados ou de produção.

## Instalação manual

Use terminais separados, a partir da raiz do repositório.

1. Configure o ambiente web e gere um segredo local:

   ```bash
   cp apps/web/.env.example apps/web/.env
   openssl rand -base64 32
   ```

   Copie o segredo para `AUTH_SECRET` em `apps/web/.env`. Para servir os gráficos quando o Next.js roda no host, configure `GRAPHS_DIR` nesse arquivo com o caminho absoluto para `storage/graphs` neste checkout.

2. Inicie PostgreSQL e Redis:

   ```bash
   docker compose up -d postgres redis
   ```

3. Instale e inicie o motor Python:

   ```bash
   cd apps/python-engine
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   GRAPHS_DIR=../../storage/graphs .venv/bin/uvicorn main:app --port 8000
   ```

4. Instale dependências web, aplique migrations e carregue o seed:

   ```bash
   cd apps/web
   npm install
   npx prisma migrate deploy
   npm run db:seed
   npm run dev
   ```

5. Inicie o worker em outro terminal:

   ```bash
   cd apps/web
   npm run worker
   ```

## Variáveis de ambiente

As variáveis da aplicação web ficam em `apps/web/.env.example`. Não versione `apps/web/.env` ou segredos reais.

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão Prisma com PostgreSQL |
| `REDIS_URL` | Conexão com Redis para filas |
| `PYTHON_ENGINE_URL` | URL do microserviço FastAPI |
| `GRAPHS_DIR` | Diretório de gráficos servido pela aplicação web; caminho absoluto para execução local |
| `AUTH_SECRET` | Segredo de sessão do Auth.js; gere com `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | Configuração do Auth.js para o host local |
| `NEXTAUTH_URL` | URL da aplicação web |

O motor Python também aceita `GRAPHS_DIR` e `PROPELLER_DATA_DIR`. Sem configuração, os dados de hélices são lidos de `apps/python-engine/data/propellers` e os gráficos são gravados em `apps/python-engine/output`.

## Configuração do projeto

- `apps/web/prisma/schema.prisma`: modelo de dados e conexão Prisma;
- `apps/web/next.config.ts`: configuração Next.js;
- `apps/web/postcss.config.mjs` e `apps/web/src/app/globals.css`: PostCSS, Tailwind CSS 4 e tema visual. Este projeto não usa `tailwind.config.ts`;
- `docker-compose.yml`: serviços PostgreSQL, Redis e motor Python;
- `apps/python-engine/Dockerfile`: imagem do serviço Python;
- `apps/web/tsconfig.json`: configuração TypeScript.

## Testes

```bash
# Testes do motor Python
(cd apps/python-engine && .venv/bin/python -m pytest tests/)

# Validação do motor contra dados experimentais e formulações analíticas
(cd apps/python-engine && .venv/bin/python tests/validation_study.py)

# Testes da aplicação web
(cd apps/web && npm test)
```

## Licença

MIT. Consulte [`LICENSE`](LICENSE).
