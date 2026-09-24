import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { analysisService } from "@/services/analysis.service";
import { AnalysisView } from "@/components/analysis-view";
import type { AnalysisMetrics, AnalysisResult } from "@/lib/python-client";

/** RF012/RF013 — Acompanhamento e visualizacao de resultados. */
export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string; analysisId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id, analysisId } = await params;

  let analysis;
  try {
    analysis = await analysisService.getOwned(analysisId, session.user.id);
  } catch {
    notFound();
  }

  const results = analysis.results as {
    metrics: AnalysisMetrics;
    series: AnalysisResult["series"];
  } | null;

  return (
    <AnalysisView
      projectId={id}
      analysis={{
        id: analysis.id,
        status: analysis.status,
        altitude: analysis.altitude,
        comparisonAltitudes: analysis.comparisonAltitudes,
        errorMessage: analysis.errorMessage,
        propeller: analysis.propeller.name,
        motor: analysis.motor.name,
        createdAt: analysis.createdAt.toISOString(),
        completedAt: analysis.completedAt?.toISOString() ?? null,
        graphs: analysis.graphs.map((g) => ({ type: g.type, filePath: g.filePath })),
      }}
      results={results}
    />
  );
}
