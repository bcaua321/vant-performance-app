import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Converte excecoes da camada de servico em respostas HTTP padronizadas. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: err.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const status = (err as { status?: number })?.status ?? 500;
  const message = err instanceof Error ? err.message : "Erro interno";
  return NextResponse.json({ error: message }, { status });
}
