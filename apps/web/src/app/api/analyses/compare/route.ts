import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { analysisService } from "@/services/analysis.service";
import { toErrorResponse } from "@/lib/api-utils";

/** RF014 — Comparar 2 a 4 analises concluidas (?ids=a,b,c). */
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(Boolean);
    const analyses = await analysisService.compare(ids, session.user!.id!);
    return NextResponse.json(analyses);
  } catch (err) {
    return toErrorResponse(err);
  }
}
