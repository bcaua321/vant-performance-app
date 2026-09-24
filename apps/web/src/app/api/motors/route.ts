import { NextResponse } from "next/server";
import { requireAdmin, requireSession } from "@/lib/auth";
import { catalogRepository } from "@/repositories/catalog.repository";
import { motorSchema } from "@/schemas/analysis.schema";
import { toErrorResponse } from "@/lib/api-utils";

/** RF010 — Listar motores com filtros opcionais. */
export async function GET(req: Request) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const motors = await catalogRepository.listMotors({
      brand: url.searchParams.get("brand") ?? undefined,
      minPower: Number(url.searchParams.get("minPower")) || undefined,
    });
    return NextResponse.json(motors);
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** RF017 — Cadastrar motor (somente administrador). */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const input = motorSchema.parse(await req.json());
    const motor = await catalogRepository.createMotor(input);
    return NextResponse.json(motor, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
