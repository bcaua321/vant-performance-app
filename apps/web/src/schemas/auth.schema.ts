import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(3, "Nome deve ter ao menos 3 caracteres").max(80),
  email: z.string().email("E-mail inválido"),
  password: z
    .string()
    .min(8, "Senha deve ter ao menos 8 caracteres")
    .regex(/[a-zA-Z]/, "Senha deve conter letras")
    .regex(/[0-9]/, "Senha deve conter números"),
});

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
