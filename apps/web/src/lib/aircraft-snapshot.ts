/**
 * Cada analise guarda uma copia dos parametros da
 * aeronave no momento em que e criada. O calculo e a exportacao usam essa
 * copia, de modo que editar a configuracao do projeto depois nao altera os
 * resultados nem os dados de analises anteriores.
 */
export type AircraftParams = {
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
};

const FIELDS: (keyof AircraftParams)[] = [
  "wingspan", "chord", "area", "clMax", "cd0", "oswald", "loadFactor",
  "emptyWeight", "payload", "batteryCapacity", "batteryVoltage", "batteryCells",
  "etaEsc", "etaMotor", "etaProp",
];

/** Copia somente os parametros de calculo (sem id, projeto ou datas). */
export function snapshotAircraft(cfg: AircraftParams): AircraftParams {
  const out = {} as AircraftParams;
  for (const k of FIELDS) out[k] = cfg[k];
  return out;
}

/**
 * Parametros usados por uma analise: a copia gravada nela ou, para analises
 * criadas antes da copia existir, a configuracao atual do projeto.
 */
export function aircraftOfAnalysis(analysis: {
  aircraftSnapshot: unknown;
  aircraftConfig: AircraftParams;
}): AircraftParams {
  const snap = analysis.aircraftSnapshot as AircraftParams | null;
  return snap ?? snapshotAircraft(analysis.aircraftConfig);
}
