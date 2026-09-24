import { z } from "zod";

export const projectSchema = z.object({
  name: z.string().min(3, "Nome deve ter entre 3 e 80 caracteres").max(80),
  description: z.string().max(500, "Descrição limitada a 500 caracteres").optional().or(z.literal("")),
});

export type ProjectInput = z.infer<typeof projectSchema>;
