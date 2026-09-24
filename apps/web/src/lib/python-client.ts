/**
 * Cliente HTTP do microservico Python de calculo.
 * O contrato de saida e validado com Zod em tempo de execucao.
 */
import { z } from "zod";

const pointSchema = z.object({ x: z.number(), y: z.number() });

export const analysisMetricsSchema = z.object({
  vStall: z.number(),
  vMin: z.number(),
  vMax: z.number(),
  rcMax: z.number(),
  vBestClimb: z.number(),
  ceiling: z.number(),
  endurance: z.number(),
  vBestEndurance: z.number(),
  range: z.number(),
  vBestRange: z.number(),
  // distancias totais: do repouso ate transpor o obstaculo de 15,24 m, e do
  // obstaculo ate a parada (definicao FAR). Ver engine/takeoff_landing.py
  takeoffDistance: z.number(),
  landingDistance: z.number(),
  // decomposicao por fase. Opcionais: analises persistidas antes da troca do
  // integrador de Euler por Runge-Kutta nao possuem estes campos no JSONB
  takeoffGroundRoll: z.number().optional(),
  takeoffClimb: z.number().optional(),
  takeoffClimbAngle: z.number().optional(),
  landingGroundRoll: z.number().optional(),
  landingAirborne: z.number().optional(),
  vLiftoff: z.number().optional(),
  vTouchdown: z.number().optional(),
  clCdMax: z.number(),
  airDensity: z.number(),
  totalWeight: z.number(),
  computeTimeMs: z.number(),
});

export const analysisResultSchema = z.object({
  metrics: analysisMetricsSchema,
  graphs: z.record(z.string(), z.string()),
  series: z.object({
    thrustAvailable: z.array(pointSchema),
    thrustRequired: z.array(pointSchema),
    powerAvailable: z.array(pointSchema),
    powerRequired: z.array(pointSchema),
    rateOfClimb: z.array(pointSchema),
    // analises persistidas antes da introducao deste campo nao o possuem; o
    // JSONB gravado e' lido por cast, entao a UI precisa tolerar a ausencia
    curvesByAltitude: z
      .array(
        z.object({
          altitude: z.number(),
          thrustAvailable: z.array(pointSchema),
          thrustRequired: z.array(pointSchema),
          powerAvailable: z.array(pointSchema),
          powerRequired: z.array(pointSchema),
          rateOfClimb: z.array(pointSchema),
        }),
      )
      .optional(),
    envelope: z.array(z.object({ altitude: z.number(), vMin: z.number(), vMax: z.number() })),
    payloadCurve: z.array(z.object({ altitude: z.number(), payload: z.number() })),
  }),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type AnalysisMetrics = z.infer<typeof analysisMetricsSchema>;

/**
 * Chaves de metrica sempre presentes, para tabelas e exportacoes que indexam
 * `AnalysisMetrics` generica­mente. Exclui a decomposicao por fase de
 * decolagem/pouso, ausente nas analises gravadas antes da troca do integrador.
 */
export type RequiredMetricKey = {
  [K in keyof AnalysisMetrics]-?: undefined extends AnalysisMetrics[K] ? never : K;
}[keyof AnalysisMetrics];

export interface PythonAnalysisInput {
  analysisId: string;
  wingspan: number;
  chord: number;
  area: number;
  clMax: number;
  cd0: number;
  oswald: number;
  loadFactor: number;
  emptyWeight: number;
  payload: number;
  batteryCapacity: number;
  batteryVoltage: number;
  batteryCells: number;
  etaEsc: number;
  etaMotor: number;
  etaProp: number;
  propellerName: string;
  propellerDiameter: number;
  propellerPitch: number;
  propellerDataFile: string | null;
  propellerTestDensity: number;
  motorName: string;
  motorKv: number;
  motorMaxPower: number;
  altitude: number;
  comparisonAltitudes: number[];
}

const ENGINE_URL = () => process.env.PYTHON_ENGINE_URL ?? "http://localhost:8000";

export async function runPythonAnalysis(input: PythonAnalysisInput): Promise<AnalysisResult> {
  const res = await fetch(`${ENGINE_URL()}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Motor de cálculo falhou (HTTP ${res.status}): ${detail}`);
  }
  return analysisResultSchema.parse(await res.json());
}

export async function pythonEngineHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${ENGINE_URL()}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
