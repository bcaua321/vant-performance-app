import { describe, expect, it } from "vitest";
import { aircraftConfigSchema } from "./aircraft.schema";
import { createAnalysisSchema } from "./analysis.schema";
import { registerSchema } from "./auth.schema";

const validConfig = {
  wingspan: 2.4,
  chord: 0.4,
  area: 0.96,
  clMax: 1.8,
  cd0: 0.035,
  oswald: 0.8,
  emptyWeight: 5.0,
  payload: 3.0,
  batteryCapacity: 16000,
  batteryVoltage: 22.2,
  batteryCells: 6,
};

describe("aircraftConfigSchema (RF008)", () => {
  it("aceita configuração válida e aplica defaults de eficiência", () => {
    const parsed = aircraftConfigSchema.parse(validConfig);
    expect(parsed.etaEsc).toBe(0.95);
    expect(parsed.etaMotor).toBe(0.85);
    expect(parsed.etaProp).toBe(0.75);
  });

  it("rejeita CL_max fora do intervalo físico [0,5; 3,0]", () => {
    expect(() => aircraftConfigSchema.parse({ ...validConfig, clMax: 10 })).toThrow();
  });

  it("coage strings numéricas de formulário", () => {
    const parsed = aircraftConfigSchema.parse({ ...validConfig, wingspan: "2.4" });
    expect(parsed.wingspan).toBe(2.4);
  });
});

describe("createAnalysisSchema (RF011)", () => {
  it("rejeita altitude acima de 11.000 m", () => {
    expect(() =>
      createAnalysisSchema.parse({
        projectId: "cmq9twvcz0002i0xuyb5vxn7q",
        propellerId: "cmq9sui000001i0lmydyz3eob",
        motorId: "cmq9sui0u000di0lmakox573l",
        altitude: 12000,
      }),
    ).toThrow();
  });
});

describe("registerSchema (RF001/RNF012)", () => {
  it("exige senha com letras e números", () => {
    expect(() =>
      registerSchema.parse({ name: "Breno", email: "b@x.com", password: "somenteletras" }),
    ).toThrow();
    expect(() =>
      registerSchema.parse({ name: "Breno", email: "b@x.com", password: "senha1234" }),
    ).not.toThrow();
  });
});
