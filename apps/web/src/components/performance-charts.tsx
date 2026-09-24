"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalysisResult } from "@/lib/python-client";

type Series = AnalysisResult["series"];

/* Duas matizes, uma por grandeza medida. O par passa nos seis testes de paleta.
   Altitude e' variavel ORDENADA, entao vira degrau de luminosidade dentro da
   propria matiz (indice 0 = altitude de operacao, o traco mais forte). */
const REQUERIDA = ["#8f5500", "#b87a1f", "#d2a24e"] as const;
const DISPONIVEL = ["#008e80", "#2a9e91", "#5cb8ad"] as const;

const MUTED = "#63665f";
const RULE = "#cbcbc2";
const HAIRLINE = "#dcdcd4";

const MONO = "var(--font-plex-mono), ui-monospace, monospace";

type ChartLine = { name: string; points: Array<{ x: number; y: number }>; color: string };

/**
 * Funde as series num unico dataset indexado por x.
 *
 * Necessario porque o `dataKey="x"` de um eixo numerico resolve contra o data do
 * GRAFICO, nao o de cada `<Line>`: passando `data` so nas linhas o dominio do
 * eixo colapsa e a area de plotagem sai vazia.
 */
export function mergeSeries(lines: ChartLine[]): Array<Record<string, number>> {
  const porX = new Map<number, Record<string, number>>();
  lines.forEach((line, i) => {
    for (const p of line.points) {
      const linha = porX.get(p.x) ?? { x: p.x };
      linha[`s${i}`] = p.y;
      porX.set(p.x, linha);
    }
  });
  return [...porX.values()].sort((a, b) => a.x - b.x);
}

function formatNum(value: number, digits = 2) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function ChartTooltip({
  active,
  payload,
  label,
  xLabel,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: number;
  xLabel: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xs border border-rule bg-panel px-3 py-2 text-xs shadow-none">
      <p className="mb-1.5 border-b border-hairline pb-1 text-muted">
        {xLabel} <span className="num text-ink">{formatNum(Number(label), 1)}</span>
      </p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-baseline justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 shrink-0" style={{ backgroundColor: entry.color }} aria-hidden />
            {entry.name}
          </span>
          <span className="num text-ink">{entry.value == null ? "–" : formatNum(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

function XYChart({
  title,
  xLabel,
  yLabel,
  lines,
}: {
  title: string;
  xLabel: string;
  yLabel: string;
  lines: ChartLine[];
}) {
  const data = mergeSeries(lines);
  // Uma curva por altitude leva a legenda a mais de uma faixa; sem reservar
  // altura proporcional ela invade a area de plotagem.
  const alturaLegenda = lines.length > 1 ? 14 + Math.ceil(lines.length / 2) * 17 : 0;

  return (
    <figure className="rounded-xs border border-rule bg-panel">
      <figcaption className="border-b border-hairline px-5 py-3 text-[0.9375rem] font-semibold tracking-tight">
        {title}
      </figcaption>
      <div className="px-2 py-4">
        <ResponsiveContainer width="100%" height={260 + alturaLegenda}>
          <LineChart data={data} margin={{ top: 4, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid stroke={HAIRLINE} strokeWidth={1} />
            <XAxis
              dataKey="x"
              type="number"
              domain={["dataMin", "dataMax"]}
              stroke={RULE}
              tickLine={false}
              tick={{ fontSize: 11, fill: MUTED, fontFamily: MONO }}
              label={{ value: xLabel, position: "insideBottom", offset: -12, fontSize: 11, fill: MUTED }}
            />
            <YAxis
              stroke={RULE}
              tickLine={false}
              tick={{ fontSize: 11, fill: MUTED, fontFamily: MONO }}
              label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 11, fill: MUTED }}
            />
            <Tooltip
              cursor={{ stroke: MUTED, strokeWidth: 1 }}
              content={<ChartTooltip xLabel={xLabel} />}
            />
            {lines.length > 1 && (
              <Legend
                verticalAlign="bottom"
                height={alturaLegenda}
                iconType="plainline"
                wrapperStyle={{ fontSize: 11, color: MUTED, paddingTop: 12 }}
              />
            )}
            {lines.map((line, i) => (
              <Line
                key={line.name}
                dataKey={`s${i}`}
                name={line.name}
                stroke={line.color}
                dot={false}
                strokeWidth={2}
                type="linear"
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/**
 * Monta as linhas de uma grandeza por altitude.
 *
 * Analises gravadas antes de `curvesByAltitude` existir nao trazem o campo (o
 * JSONB e' lido por cast, sem validacao), entao cai para a serie plana da
 * altitude de operacao.
 */
function linhasPorAltitude(
  series: Series,
  disponivel: "thrustAvailable" | "powerAvailable" | null,
  requerida: "thrustRequired" | "powerRequired" | "rateOfClimb",
  rotuloD: string,
  rotuloR: string,
): ChartLine[] {
  const porAlt = series.curvesByAltitude;
  if (!porAlt?.length) {
    const planas: ChartLine[] = [{ name: rotuloR, points: series[requerida], color: REQUERIDA[0] }];
    if (disponivel) {
      planas.unshift({ name: rotuloD, points: series[disponivel], color: DISPONIVEL[0] });
    }
    return planas;
  }
  const varias = porAlt.length > 1;
  const sufixo = (h: number) => (varias ? ` · ${h.toFixed(0)} m` : "");
  return porAlt.flatMap((c, i) => {
    const linhas: ChartLine[] = [];
    if (disponivel) {
      linhas.push({
        name: `${rotuloD}${sufixo(c.altitude)}`,
        points: c[disponivel],
        color: DISPONIVEL[i % DISPONIVEL.length],
      });
    }
    linhas.push({
      name: `${rotuloR}${sufixo(c.altitude)}`,
      points: c[requerida],
      color: REQUERIDA[i % REQUERIDA.length],
    });
    return linhas;
  });
}

/** RF013 — Graficos interativos da analise (Recharts). */
export function PerformanceCharts({ series }: { series: Series }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <XYChart
        title="Tração disponível e requerida"
        xLabel="Velocidade (m/s)"
        yLabel="Tração (N)"
        lines={linhasPorAltitude(series, "thrustAvailable", "thrustRequired", "Disponível", "Requerida")}
      />
      <XYChart
        title="Potência disponível e requerida"
        xLabel="Velocidade (m/s)"
        yLabel="Potência (W)"
        lines={linhasPorAltitude(series, "powerAvailable", "powerRequired", "Disponível", "Requerida")}
      />
      <XYChart
        title="Razão de subida"
        xLabel="Velocidade (m/s)"
        yLabel="RC (m/s)"
        lines={linhasPorAltitude(series, null, "rateOfClimb", "", "Razão de subida")}
      />
      <XYChart
        title="Envelope de voo"
        xLabel="Velocidade (m/s)"
        yLabel="Altitude (m)"
        lines={[
          {
            name: "Velocidade mínima",
            points: series.envelope.map((e) => ({ x: e.vMin, y: e.altitude })),
            color: DISPONIVEL[0],
          },
          {
            name: "Velocidade máxima",
            points: series.envelope.map((e) => ({ x: e.vMax, y: e.altitude })),
            color: REQUERIDA[0],
          },
        ]}
      />
      <XYChart
        title="Carga paga máxima por altitude densidade"
        xLabel="Altitude (m)"
        yLabel="Carga paga (kg)"
        lines={[
          {
            name: "Carga paga máxima",
            points: series.payloadCurve.map((p) => ({ x: p.altitude, y: p.payload })),
            color: REQUERIDA[0],
          },
        ]}
      />
    </div>
  );
}

/* Ordem fixa para comparacao entre analises: nunca reciclada, para que a cor
   siga a analise e nao a posicao na lista. */
const COMPARACAO = [REQUERIDA[0], DISPONIVEL[0], REQUERIDA[1], DISPONIVEL[1]];

/** RF014 — Graficos sobrepostos para comparacao de analises. */
export function ComparisonCharts({ items }: { items: Array<{ label: string; series: Series }> }) {
  const linhas = (pick: (s: Series) => Array<{ x: number; y: number }>): ChartLine[] =>
    items.map((it, i) => ({
      name: it.label,
      points: pick(it.series),
      color: COMPARACAO[i % COMPARACAO.length],
    }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <XYChart
        title="Tração disponível"
        xLabel="Velocidade (m/s)"
        yLabel="Tração (N)"
        lines={linhas((s) => s.thrustAvailable)}
      />
      <XYChart
        title="Potência requerida"
        xLabel="Velocidade (m/s)"
        yLabel="Potência (W)"
        lines={linhas((s) => s.powerRequired)}
      />
      <XYChart
        title="Razão de subida"
        xLabel="Velocidade (m/s)"
        yLabel="RC (m/s)"
        lines={linhas((s) => s.rateOfClimb)}
      />
      <XYChart
        title="Envelope de voo — velocidade máxima"
        xLabel="Velocidade (m/s)"
        yLabel="Altitude (m)"
        lines={linhas((s) => s.envelope.map((e) => ({ x: e.vMax, y: e.altitude })))}
      />
    </div>
  );
}
