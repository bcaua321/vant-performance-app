import { describe, expect, it } from "vitest";
import { aircraftOfAnalysis, snapshotAircraft, type AircraftParams } from "./aircraft-snapshot";

const cfg: AircraftParams = {
  wingspan: 2.4, chord: 0.4, area: 0.96, clMax: 1.8, cd0: 0.035, oswald: 0.8, loadFactor: 3.8,
  emptyWeight: 5, payload: 3, batteryCapacity: 4000, batteryVoltage: 22.2, batteryCells: 6,
  etaEsc: 0.95, etaMotor: 0.85, etaProp: 0.75,
};

describe("cópia da configuração da aeronave na análise", () => {
  it("copia só os parâmetros de cálculo", () => {
    const comExtras = { ...cfg, id: "c1", projectId: "p1", createdAt: new Date() };
    expect(snapshotAircraft(comExtras)).toEqual(cfg);
  });

  it("editar a configuração depois não altera a cópia da análise", () => {
    const snap = snapshotAircraft(cfg);
    const editada = { ...cfg, batteryCapacity: 16000, payload: 1 };
    expect(aircraftOfAnalysis({ aircraftSnapshot: snap, aircraftConfig: editada })).toEqual(cfg);
  });

  it("análise antiga, sem cópia, usa a configuração do projeto", () => {
    expect(aircraftOfAnalysis({ aircraftSnapshot: null, aircraftConfig: cfg })).toEqual(cfg);
  });
});
