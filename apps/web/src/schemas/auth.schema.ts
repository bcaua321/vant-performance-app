import { z } from "zod";

/** Regra de senha do cadastro, reaproveitada na redefinicao de senha. */
const passwordRule = z
  .string()
  .min(8, "Senha deve ter ao menos 8 caracteres")
  .regex(/[a-zA-Z]/, "Senha deve conter letras")
  .regex(/[0-9]/, "Senha deve conter números");

export const registerSchema = z.object({
  name: z.string().min(3, "Nome deve ter ao menos 3 caracteres").max(80),
  email: z.string().email("E-mail inválido"),
  password: passwordRule,
});

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
});

/** Solicitar recuperacao de senha. */
export const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

/** Redefinir a senha com o token recebido. */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Link de recuperação inválido"),
  password: passwordRule,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
