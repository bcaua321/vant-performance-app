import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/schemas/auth.schema";
import { toErrorResponse } from "@/lib/api-utils";
import { requestPasswordReset } from "@/lib/password-reset";

/**
 * Solicitar recuperacao de senha. Responde sempre da mesma forma,
 * exista ou nao o e-mail, para nao revelar contas cadastradas.
 */
export async function POST(req: Request) {
  try {
    const { email } = forgotPasswordSchema.parse(await req.json());
    // URL base da configuracao (nao do cabecalho Host, que o cliente controla).
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? new URL(req.url).origin;
    await requestPasswordReset(email, baseUrl);
    return NextResponse.json({
      message: "Se o e-mail estiver cadastrado, um link de redefinição foi enviado.",
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
