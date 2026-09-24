import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { analysisService } from "@/services/analysis.service";
import { Button, Card, CardBody, CardHeader } from "@/components/ui";
import { ComparisonCharts } from "@/components/performance-charts";
import { METRIC_LABELS } from "@/lib/export";
import type { AnalysisMetrics, AnalysisResult } from "@/lib/python-client";

/** RF014 — Comparacao lado a lado de 2 a 4 analises. */
export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ids?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  const { ids } = await searchParams;
  const idList = (ids ?? "").split(",").filter(Boolean);

  let analyses;
  try {
    analyses = await analysisService.compare(idList, session.user.id);
  } catch (err) {
    return (
      <Card>
        <CardBody className="py-10 text-center text-sm text-muted">
          {(err as Error).message}.{" "}
          <Link href={`/projects/${id}`} className="text-ink underline decoration-rule underline-offset-2 hover:decoration-ink">
            Voltar ao projeto
          </Link>
        </CardBody>
      </Card>
    );
  }

  const items = analyses.map((a) => {
    const results = a.results as { metrics: AnalysisMetrics; series: AnalysisResult["series"] };
    return {
      id: a.id,
      label: `${a.propeller.name} · ${a.motor.name} · ${a.altitude} m`,
      metrics: results.metrics,
      series: results.series,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Comparação de análises</h1>
        <Link href={`/projects/${id}`}>
          <Button variant="ghost">Voltar</Button>
        </Link>
      </div>

      <Card>
        <CardHeader title="Métricas lado a lado" />
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-muted">
                <th className="py-2 pr-4">Parâmetro</th>
                {items.map((it) => (
                  <th key={it.id} className="py-2 pr-4">
                    {it.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRIC_LABELS.map(({ key, label, unit }) => (
                <tr key={key} className="border-b border-hairline">
                  <td className="py-2 pr-4 text-muted">
                    {label} {unit !== "—" && <span className="text-xs text-faint">({unit})</span>}
                  </td>
                  {items.map((it) => (
                    <td key={it.id} className="py-2 pr-4 font-medium">
                      {it.metrics[key] < 0 ? "—" : it.metrics[key].toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <ComparisonCharts items={items} />
    </div>
  );
}
