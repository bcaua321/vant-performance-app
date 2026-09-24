import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { analysisService } from "@/services/analysis.service";
import { toErrorResponse } from "@/lib/api-utils";
import { buildAnalysisPdf, metricsToCsv } from "@/lib/export";
import type { AnalysisMetrics } from "@/lib/python-client";

type Params = { params: Promise<{ id: string }> };

/** RF015 — Exportar resultados em PDF, JSON ou CSV (?format=). */
export async function GET(req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const analysis = await analysisService.getOwned(id, session.user!.id!);
    if (analysis.status !== "DONE" || !analysis.results) {
      return NextResponse.json({ error: "Análise ainda não concluída" }, { status: 422 });
    }
    const format = new URL(req.url).searchParams.get("format") ?? "json";
    const results = analysis.results as { metrics: AnalysisMetrics };
    const baseName = `analise-${id.slice(-8)}`;

    if (format === "json") {
      return new NextResponse(JSON.stringify({ analysis: { id, altitude: analysis.altitude, propeller: analysis.propeller.name, motor: analysis.motor.name }, ...results }, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${baseName}.json"`,
        },
      });
    }
    if (format === "csv") {
      return new NextResponse(metricsToCsv(results.metrics), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseName}.csv"`,
        },
      });
    }
    if (format === "pdf") {
      const pdf = await buildAnalysisPdf(analysis, results.metrics);
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
        },
      });
    }
    return NextResponse.json({ error: "Formato inválido: use pdf, json ou csv" }, { status: 400 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
