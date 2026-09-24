/** Exportacao de resultados (RF015): CSV e PDF. */
import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { AnalysisMetrics, RequiredMetricKey } from "@/lib/python-client";
import type { Analysis, Motor, Propeller } from "@prisma/client";

export const METRIC_LABELS: Array<{ key: RequiredMetricKey; label: string; unit: string }> = [
  { key: "vStall", label: "Velocidade de estol", unit: "m/s" },
  { key: "vMin", label: "Velocidade mínima de voo nivelado", unit: "m/s" },
  { key: "vMax", label: "Velocidade máxima de voo nivelado", unit: "m/s" },
  { key: "rcMax", label: "Razão de subida máxima", unit: "m/s" },
  { key: "vBestClimb", label: "Velocidade de melhor subida", unit: "m/s" },
  { key: "ceiling", label: "Teto de serviço", unit: "m" },
  { key: "endurance", label: "Autonomia", unit: "h" },
  { key: "vBestEndurance", label: "Velocidade de melhor autonomia", unit: "m/s" },
  { key: "range", label: "Alcance", unit: "km" },
  { key: "vBestRange", label: "Velocidade de melhor alcance", unit: "m/s" },
  { key: "takeoffDistance", label: "Distância de decolagem", unit: "m" },
  { key: "landingDistance", label: "Distância de pouso", unit: "m" },
  { key: "clCdMax", label: "(L/D) máximo", unit: "—" },
  { key: "airDensity", label: "Densidade do ar", unit: "kg/m³" },
  { key: "totalWeight", label: "Peso total", unit: "N" },
];

export function metricsToCsv(metrics: AnalysisMetrics): string {
  const lines = ["parametro,valor,unidade"];
  for (const { key, label, unit } of METRIC_LABELS) {
    lines.push(`"${label}",${metrics[key].toFixed(3)},"${unit}"`);
  }
  return lines.join("\n");
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 10, color: "#555", marginBottom: 16 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ccc", paddingVertical: 4 },
  cellLabel: { flex: 3 },
  cellValue: { flex: 1, textAlign: "right", fontFamily: "Helvetica-Bold" },
  cellUnit: { flex: 1, textAlign: "left", paddingLeft: 6, color: "#555" },
});

type FullAnalysis = Analysis & { propeller: Propeller; motor: Motor };

export async function buildAnalysisPdf(analysis: FullAnalysis, metrics: AnalysisMetrics): Promise<Buffer> {
  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.title }, "VANT-Performance — Relatório de Análise"),
      React.createElement(
        Text,
        { style: styles.subtitle },
        `Hélice: ${analysis.propeller.name} · Motor: ${analysis.motor.name} · Altitude: ${analysis.altitude} m · ` +
          `Concluída em: ${analysis.completedAt?.toLocaleString("pt-BR") ?? "—"}`,
      ),
      ...METRIC_LABELS.map(({ key, label, unit }) =>
        React.createElement(
          View,
          { style: styles.row, key },
          React.createElement(Text, { style: styles.cellLabel }, label),
          React.createElement(Text, { style: styles.cellValue }, metrics[key].toFixed(2)),
          React.createElement(Text, { style: styles.cellUnit }, unit),
        ),
      ),
    ),
  );
  return renderToBuffer(doc);
}
