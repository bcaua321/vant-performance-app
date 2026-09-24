"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, Input, Label, Select } from "@/components/ui";

interface PropellerOption {
  id: string;
  name: string;
  diameter: number;
  pitch: number;
  hasData: boolean;
}

interface MotorOption {
  id: string;
  name: string;
  kvRating: number;
  maxPower: number;
}

export function AnalysisForm({
  projectId,
  projectName,
  propellers,
  motors,
}: {
  projectId: string;
  projectName: string;
  propellers: PropellerOption[];
  motors: MotorOption[];
}) {
  const router = useRouter();
  const [propellerId, setPropellerId] = useState("");
  const [motorId, setMotorId] = useState("");
  const [altitude, setAltitude] = useState("0");
  const [extraAltitudes, setExtraAltitudes] = useState("");
  const [minDiameter, setMinDiameter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredPropellers = useMemo(() => {
    const min = Number(minDiameter);
    return minDiameter ? propellers.filter((p) => p.diameter >= min) : propellers;
  }, [propellers, minDiameter]);

  /** "600, 1500" -> [600, 1500]. Lanca com mensagem legivel se houver lixo. */
  function parseExtraAltitudes(texto: string): number[] {
    const itens = texto
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (itens.length > 3) throw new Error("Informe no máximo 3 altitudes adicionais.");
    return itens.map((s) => {
      const n = Number(s);
      if (!Number.isFinite(n) || n < 0 || n > 11000) {
        throw new Error(`Altitude adicional inválida: "${s}". Use valores de 0 a 11.000 m.`);
      }
      return n;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!propellerId || !motorId) {
      setError("Selecione hélice e motor.");
      return;
    }
    let comparisonAltitudes: number[];
    try {
      comparisonAltitudes = parseExtraAltitudes(extraAltitudes);
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        propellerId,
        motorId,
        altitude: Number(altitude),
        comparisonAltitudes,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Falha ao criar análise");
      return;
    }
    const analysis = await res.json();
    router.push(`/projects/${projectId}/analyses/${analysis.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader
          title="Nova análise"
          subtitle={`Projeto: ${projectName} — a análise roda em segundo plano e o status é atualizado automaticamente`}
        />
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="minDiameter">Filtrar hélices por diâmetro mínimo (pol)</Label>
              <Input
                id="minDiameter"
                type="number"
                placeholder="Ex.: 20"
                value={minDiameter}
                onChange={(e) => setMinDiameter(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="propeller">Hélice</Label>
              <Select id="propeller" value={propellerId} onChange={(e) => setPropellerId(e.target.value)}>
                <option value="">Selecione...</option>
                {filteredPropellers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.diameter}×{p.pitch}&quot; {p.hasData ? "(dados experimentais)" : "(modelo analítico)"}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="motor">Motor</Label>
              <Select id="motor" value={motorId} onChange={(e) => setMotorId(e.target.value)}>
                <option value="">Selecione...</option>
                {motors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.kvRating} KV, {m.maxPower} W
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="altitude" hint="Altitude-densidade da operação (0 a 11.000 m)">
                Altitude de operação (m)
              </Label>
              <Input
                id="altitude"
                type="number"
                min={0}
                max={11000}
                step={50}
                value={altitude}
                onChange={(e) => setAltitude(e.target.value)}
              />
            </div>
            <div>
              <Label
                htmlFor="extraAltitudes"
                hint="Opcional. Até 3 valores separados por vírgula, ex.: 600, 1500. Vazio usa +500 m e +1000 m."
              >
                Altitudes adicionais nos gráficos (m)
              </Label>
              <Input
                id="extraAltitudes"
                type="text"
                inputMode="numeric"
                placeholder="600, 1500"
                value={extraAltitudes}
                onChange={(e) => setExtraAltitudes(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-alarm">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Enfileirando..." : "Executar análise"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
