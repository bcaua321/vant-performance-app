import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { analysisService } from "@/services/analysis.service";
import { createAnalysisSchema } from "@/schemas/analysis.schema";
import { toErrorResponse } from "@/lib/api-utils";

/** RF011 — Criar analise e enfileirar job BullMQ. */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const input = createAnalysisSchema.parse(await req.json());
    const analysis = await analysisService.create(session.user!.id!, input);
    return NextResponse.json(analysis, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
