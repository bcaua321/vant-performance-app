import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { analysisService } from "@/services/analysis.service";
import { toErrorResponse } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/** RF012 — Endpoint de polling do status da analise. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const status = await analysisService.getStatus(id, session.user!.id!);
    return NextResponse.json(status);
  } catch (err) {
    return toErrorResponse(err);
  }
}
