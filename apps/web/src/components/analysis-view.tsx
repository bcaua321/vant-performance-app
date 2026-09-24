"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, PageHead, StatusBadge } from "@/components/ui";
import { MetricsTable } from "@/components/metrics-table";
import { PerformanceCharts } from "@/components/performance-charts";
import type { AnalysisMetrics, AnalysisResult } from "@/lib/python-client";

interface AnalysisData {
  id: string;
  status: string;
  altitude: number;
  comparisonAltitudes: number[];
  errorMessage: string | null;
  propeller: string;
  motor: string;
  createdAt: string;
  completedAt: string | null;
  graphs: Array<{ type: string; filePath: string }>;
}

export function AnalysisView({
  projectId,
  analysis,
  results,
}: {
  projectId: string;
  analysis: AnalysisData;
  results: { metrics: AnalysisMetrics; series: AnalysisResult["series"] } | null;
}) {
  const router = useRouter();
  const inProgress = analysis.status === "PENDING" || analysis.status === "RUNNING";

  // RF012 — polling a cada 2 s enquanto a analise nao termina
  useEffect(() => {
    if (!inProgress) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/analyses/${analysis.id}/status`);
      if (!res.ok) return;
      const { status } = await res.json();
      if (status !== analysis.status) router.refresh();
    }, 2000);
    return () => clearInterval(timer);
  }, [inProgress, analysis.id, analysis.status, router]);

  return (
    <div className="space-y-6">
      <PageHead
        title="Análise de desempenho"
        status={<StatusBadge status={analysis.status} />}
        meta={
          <>
            {analysis.propeller} · {analysis.motor} · altitude <span className="num">{analysis.altitude}</span> m
            {analysis.comparisonAltitudes.length > 0 && (
              <> · curvas também em {analysis.comparisonAltitudes.map((a) => `${a} m`).join(", ")}</>
            )}
          </>
        }
        actions={
          <>
            {analysis.status === "DONE" && (
              <>
                <a href={`/api/analyses/${analysis.id}/export?format=pdf`}>
                  <Button variant="outline">Baixar PDF</Button>
                </a>
                <a href={`/api/analyses/${analysis.id}/export?format=csv`}>
                  <Button variant="outline">CSV</Button>
                </a>
                <a href={`/api/analyses/${analysis.id}/export?format=json`}>
                  <Button variant="outline">JSON</Button>
                </a>
              </>
            )}
            <Link href={`/projects/${projectId}`}>
              <Button variant="ghost">Voltar ao projeto</Button>
            </Link>
          </>
        }
      />

      {inProgress && (
        <Card>
          <CardBody className="flex items-center gap-3 py-8">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" aria-hidden />
            <p className="text-sm text-muted">
              {analysis.status === "PENDING"
                ? "Na fila de processamento."
                : "Motor de cálculo executando."}{" "}
              Esta página se atualiza sozinha quando terminar.
            </p>
          </CardBody>
        </Card>
      )}

      {analysis.status === "FAILED" && (
        <Card className="border-alarm">
          <CardHeader
            title="A análise não foi concluída"
            subtitle="Revise os parâmetros da aeronave e execute de novo. O motor de cálculo respondeu:"
          />
          <CardBody>
            <pre className="overflow-x-auto rounded-xs border border-hairline bg-paper p-4 text-xs text-alarm">
              {analysis.errorMessage ?? "Erro sem descrição."}
            </pre>
          </CardBody>
        </Card>
      )}

      {analysis.status === "DONE" && results && (
        <>
          <MetricsTable metrics={results.metrics} />
          <PerformanceCharts series={results.series} />
          {analysis.graphs.length > 0 && (
            <Card>
              <CardHeader
                title="Gráficos do motor de cálculo"
                subtitle="Versões em PNG, as mesmas que entram nos relatórios exportados."
              />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                {analysis.graphs.map((g) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={g.type}
                    src={`/api/graphs/${g.filePath}`}
                    alt={g.type}
                    className="w-full rounded-xs border border-hairline"
                  />
                ))}
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
