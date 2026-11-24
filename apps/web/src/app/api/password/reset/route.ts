import { NextResponse } from "next/server";
import { resetPasswordSchema } from "@/schemas/auth.schema";
import { toErrorResponse } from "@/lib/api-utils";
import { resetPassword } from "@/lib/password-reset";

/** Redefinir a senha com o token recebido (uso unico, validade de 1 hora). */
export async function POST(req: Request) {
  try {
    const { token, password } = resetPasswordSchema.parse(await req.json());
    const ok = await resetPassword(token, password);
    if (!ok) {
      return NextResponse.json(
        { error: "Link de recuperação inválido, expirado ou já utilizado." },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Senha redefinida." });
  } catch (err) {
    return toErrorResponse(err);
  }
}
