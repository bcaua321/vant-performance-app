import { z } from "zod";

/** Validacao da configuracao de aeronave. */
export const aircraftConfigSchema = z.object({
  wingspan: z.coerce.number().positive("Envergadura deve ser positiva").max(20, "Máximo 20 m"),
  chord: z.coerce.number().positive("Corda deve ser positiva").max(5, "Máximo 5 m"),
  area: z.coerce.number().positive("Área deve ser positiva").max(50, "Máximo 50 m²"),
  clMax: z.coerce.number().min(0.5, "CL_max entre 0,5 e 3,0").max(3.0, "CL_max entre 0,5 e 3,0"),
  cd0: z.coerce.number().min(0.005, "CD0 entre 0,005 e 0,2").max(0.2, "CD0 entre 0,005 e 0,2"),
  oswald: z.coerce.number().min(0.5, "e entre 0,5 e 1,0").max(1.0, "e entre 0,5 e 1,0"),
  loadFactor: z.coerce.number().min(1.5, "n entre 1,5 e 10").max(10, "n entre 1,5 e 10").default(3.8),
  emptyWeight: z.coerce.number().positive("Peso vazio deve ser positivo"),
  payload: z.coerce.number().min(0, "Carga paga não pode ser negativa"),
  batteryCapacity: z.coerce.number().int().positive("Capacidade em mAh deve ser positiva"),
  batteryVoltage: z.coerce.number().positive("Tensão deve ser positiva"),
  batteryCells: z.coerce.number().int().min(1).max(12, "Entre 1 e 12 células"),
  etaEsc: z.coerce.number().min(0.5).max(1.0).default(0.95),
  etaMotor: z.coerce.number().min(0.5).max(1.0).default(0.85),
  etaProp: z.coerce.number().min(0.3).max(1.0).default(0.75),
});

export type AircraftConfigInput = z.infer<typeof aircraftConfigSchema>;
