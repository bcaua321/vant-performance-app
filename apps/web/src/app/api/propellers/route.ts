import { NextResponse } from "next/server";
import { requireAdmin, requireSession } from "@/lib/auth";
import { catalogRepository } from "@/repositories/catalog.repository";
import { propellerSchema } from "@/schemas/analysis.schema";
import { toErrorResponse } from "@/lib/api-utils";

/** RF009 — Listar helices com filtros opcionais. */
export async function GET(req: Request) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const propellers = await catalogRepository.listPropellers({
      manufacturer: url.searchParams.get("manufacturer") ?? undefined,
      minDiameter: Number(url.searchParams.get("minDiameter")) || undefined,
      maxDiameter: Number(url.searchParams.get("maxDiameter")) || undefined,
    });
    return NextResponse.json(propellers);
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** RF016 — Cadastrar helice (somente administrador). */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const input = propellerSchema.parse(await req.json());
    const propeller = await catalogRepository.createPropeller({
      ...input,
      dataFilePath: input.dataFilePath ?? null,
    });
    return NextResponse.json(propeller, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
