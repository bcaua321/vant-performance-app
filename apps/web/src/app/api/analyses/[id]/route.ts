import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { analysisService } from "@/services/analysis.service";
import { toErrorResponse } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const analysis = await analysisService.getOwned(id, session.user!.id!);
    return NextResponse.json(analysis);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await analysisService.delete(id, session.user!.id!);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
