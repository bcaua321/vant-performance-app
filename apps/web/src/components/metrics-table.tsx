import type { AnalysisMetrics } from "@/lib/python-client";

/** Detalhe por fase exibido sob a distância total (Phillips, 2004, sec. 3.10). */
function phaseHint(key: keyof AnalysisMetrics, m: AnalysisMetrics): string | null {
  const fmt = (v: number) => `${v.toFixed(0)} m`;
  // mesma ordem e mesmo vocabulario do grafico de manobras de solo: primeiro a
  // pista consumida, depois o trecho no ar. Ler as duas manobras na mesma
  // sequencia e o que permite compara-las de relance.
  if (key === "takeoffDistance" && m.takeoffGroundRoll != null && m.takeoffClimb != null) {
    return `solo ${fmt(m.takeoffGroundRoll)} + ar ${fmt(m.takeoffClimb)}`;
  }
  if (key === "landingDistance" && m.landingAirborne != null && m.landingGroundRoll != null) {
    return `solo ${fmt(m.landingGroundRoll)} + ar ${fmt(m.landingAirborne)}`;
  }
  return null;
}

interface Row {
  key: keyof AnalysisMetrics;
  label: string;
  unit: string;
  digits?: number;
  /** Borda do envelope de voo: recebe o fio âmbar. */
  limit?: boolean;
}

/* Agrupadas por família física, na ordem em que o desempenho é lido:
   primeiro onde a aeronave voa, depois quanto sobe, quanto dura, quanta pista. */
const GROUPS: Array<{ name: string; rows: Row[] }> = [
  {
    name: "Velocidades",
    rows: [
      { key: "vStall", label: "Estol", unit: "m/s", limit: true },
      { key: "vMin", label: "Mínima em voo nivelado", unit: "m/s" },
      { key: "vMax", label: "Máxima", unit: "m/s", limit: true },
    ],
  },
  {
    name: "Subida e teto",
    rows: [
      { key: "rcMax", label: "Razão de subida máxima", unit: "m/s" },
      { key: "vBestClimb", label: "Velocidade de melhor subida", unit: "m/s" },
      { key: "ceiling", label: "Teto de serviço", unit: "m", digits: 0, limit: true },
    ],
  },
  {
    name: "Alcance",
    rows: [
      { key: "endurance", label: "Autonomia", unit: "h" },
      { key: "range", label: "Alcance", unit: "km", digits: 1 },
    ],
  },
  {
    name: "Pista",
    rows: [
      { key: "takeoffDistance", label: "Decolagem até obstáculo de 15,24 m", unit: "m", digits: 1 },
      { key: "landingDistance", label: "Pouso desde obstáculo de 15,24 m", unit: "m", digits: 1 },
    ],
  },
  {
    name: "Aerodinâmica e massa",
    rows: [
      { key: "clCdMax", label: "Eficiência aerodinâmica máxima (L/D)", unit: "" },
      { key: "totalWeight", label: "Peso total", unit: "N", digits: 1 },
    ],
  },
];

function format(value: number, digits: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function MetricsTable({ metrics }: { metrics: AnalysisMetrics }) {
  return (
    <section aria-labelledby="plate-heading" className="rounded-xs border border-rule bg-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-hairline px-5 py-3.5">
        <h2 id="plate-heading" className="text-[0.9375rem] font-semibold tracking-tight">
          Desempenho calculado
        </h2>
        <p className="text-[0.8125rem] text-muted">
          Densidade do ar <span className="num">{format(metrics.airDensity, 4)}</span> kg/m³ · calculado em{" "}
          <span className="num">{format(metrics.computeTimeMs, 0)}</span> ms
        </p>
      </div>

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Métricas de desempenho agrupadas por família física</caption>
        {/* Um tbody por grupo: no desktop o nome ocupa a coluna da esquerda; em
            tela estreita essa coluna sumiria espremendo os rotulos, entao vira
            uma faixa acima das linhas. */}
        {GROUPS.map((group, groupIndex) => (
          <tbody key={group.name} className={groupIndex > 0 ? "border-t border-rule" : undefined}>
            <tr className="sm:hidden">
              <th scope="colgroup" colSpan={4} className="px-5 pt-3 pb-1 text-left font-medium text-muted">
                {group.name}
              </th>
            </tr>
            {group.rows.map((row, rowIndex) => {
              const value = metrics[row.key] as number;
              const unavailable = value < 0;
              const hint = unavailable ? null : phaseHint(row.key, metrics);
              return (
                <tr key={row.key}>
                  <th
                    scope="row"
                    className="hidden w-[13rem] py-2.5 pr-4 pl-5 text-left align-top font-medium text-muted sm:table-cell"
                  >
                    {rowIndex === 0 && group.name}
                  </th>
                  <td className="py-2.5 pr-4 pl-5 align-top sm:pl-0">
                    <span
                      className={`border-l-2 pl-2.5 ${row.limit ? "border-signal text-ink" : "border-transparent"}`}
                    >
                      {row.label}
                    </span>
                    {hint && <span className="mt-0.5 block pl-3 text-[0.75rem] text-muted">{hint}</span>}
                  </td>
                  {/* Valor e unidade em celulas separadas: so assim os numeros
                      alinham na virgula e as unidades alinham entre si. */}
                  <td className="py-2.5 pr-2 text-right align-top whitespace-nowrap">
                    <span className={`num text-[0.9375rem] ${unavailable ? "text-faint" : "text-ink"}`}>
                      {unavailable ? "–" : format(value, row.digits ?? 2)}
                    </span>
                  </td>
                  <td className="w-12 py-2.5 pr-5 pl-1.5 text-left align-top text-[0.75rem] text-muted">
                    {!unavailable && row.unit}
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>

      <p className="border-t border-hairline px-5 py-2.5 text-[0.75rem] text-faint">
        <span className="mr-2 inline-block h-2.5 w-0.5 translate-y-px bg-signal" aria-hidden />
        Fio âmbar marca os limites do envelope de voo.
      </p>
    </section>
  );
}
