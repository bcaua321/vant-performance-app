import { z } from "zod";

/** Validacao da criacao de analise. */
export const createAnalysisSchema = z.object({
  projectId: z.string().cuid("projectId inválido"),
  propellerId: z.string().cuid("propellerId inválido"),
  motorId: z.string().cuid("motorId inválido"),
  altitude: z.coerce.number().min(0, "Altitude entre 0 e 11.000 m").max(11000, "Altitude entre 0 e 11.000 m"),
  comparisonAltitudes: z
    .array(z.coerce.number().min(0, "Altitude entre 0 e 11.000 m").max(11000, "Altitude entre 0 e 11.000 m"))
    .max(3, "No máximo 3 altitudes adicionais")
    .default([]),
});

export const propellerSchema = z.object({
  name: z.string().min(2).max(60),
  diameter: z.coerce.number().positive().max(40),
  pitch: z.coerce.number().positive().max(30),
  manufacturer: z.string().min(2).max(40),
  dataFilePath: z.string().max(120).nullable().optional(),
  testDensity: z.coerce.number().positive().max(1.5).default(1.225),
});

export const motorSchema = z.object({
  name: z.string().min(2).max(60),
  brand: z.string().min(2).max(40),
  kvRating: z.coerce.number().int().positive().max(5000),
  maxPower: z.coerce.number().positive().max(20000),
  maxCurrent: z.coerce.number().positive().max(500),
  weight: z.coerce.number().positive().max(5000),
  internalResistance: z.coerce.number().positive().max(5),
});

export type CreateAnalysisInput = z.infer<typeof createAnalysisSchema>;
