"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { aircraftConfigSchema, type AircraftConfigInput } from "@/schemas/aircraft.schema";
import { Button, Card, CardBody, CardHeader, FieldError, Input, Label } from "@/components/ui";

const DEFAULTS: AircraftConfigInput = {
  wingspan: 2.4,
  chord: 0.4,
  area: 0.96,
  clMax: 1.8,
  cd0: 0.035,
  oswald: 0.8,
  loadFactor: 3.8,
  emptyWeight: 5.0,
  payload: 3.0,
  batteryCapacity: 16000,
  batteryVoltage: 22.2,
  batteryCells: 6,
  etaEsc: 0.95,
  etaMotor: 0.85,
  etaProp: 0.75,
};

interface FieldDef {
  name: keyof AircraftConfigInput;
  label: string;
  hint: string;
  step?: string;
}

const SECTIONS: Array<{ title: string; fields: FieldDef[] }> = [
  {
    title: "Geometria",
    fields: [
      { name: "wingspan", label: "Envergadura (m)", hint: "Distância entre as pontas das asas", step: "0.01" },
      { name: "chord", label: "Corda média (m)", hint: "Largura média da asa", step: "0.01" },
      { name: "area", label: "Área alar (m²)", hint: "Área de referência da asa", step: "0.01" },
    ],
  },
  {
    title: "Aerodinâmica",
    fields: [
      { name: "clMax", label: "CL máximo", hint: "Coeficiente de sustentação máximo (0,5–3,0)", step: "0.01" },
      { name: "cd0", label: "CD0 (arrasto parasita)", hint: "Coeficiente de arrasto parasita (0,005–0,2)", step: "0.001" },
      { name: "oswald", label: "Fator de Oswald (e)", hint: "Eficiência da asa (0,5–1,0)", step: "0.01" },
      { name: "loadFactor", label: "Fator de carga limite (n)", hint: "Limite estrutural positivo; fecha o envelope no ponto de manobra", step: "0.1" },
    ],
  },
  {
    title: "Pesos",
    fields: [
      { name: "emptyWeight", label: "Peso vazio (kg)", hint: "Massa da aeronave sem carga paga", step: "0.1" },
      { name: "payload", label: "Carga paga (kg)", hint: "Massa transportada", step: "0.1" },
    ],
  },
  {
    title: "Bateria",
    fields: [
      { name: "batteryCapacity", label: "Capacidade (mAh)", hint: "Capacidade nominal da bateria", step: "100" },
      { name: "batteryVoltage", label: "Tensão nominal (V)", hint: "Ex.: 22,2 V para 6S LiPo", step: "0.1" },
      { name: "batteryCells", label: "Células (S)", hint: "Número de células em série (1–12)", step: "1" },
    ],
  },
  {
    title: "Eficiências do conjunto propulsivo",
    fields: [
      { name: "etaEsc", label: "Eficiência do ESC", hint: "Tipicamente 0,95", step: "0.01" },
      { name: "etaMotor", label: "Eficiência do motor", hint: "Tipicamente 0,85", step: "0.01" },
      { name: "etaProp", label: "Eficiência da hélice", hint: "Tipicamente 0,75 em cruzeiro", step: "0.01" },
    ],
  },
];

export function AircraftForm({
  projectId,
  projectName,
  initial,
}: {
  projectId: string;
  projectName: string;
  initial: AircraftConfigInput | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AircraftConfigInput>({
    resolver: zodResolver(aircraftConfigSchema),
    defaultValues: initial ?? DEFAULTS,
  });

  async function onSubmit(data: AircraftConfigInput) {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/aircraft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Falha ao salvar configuração");
      return;
    }
    router.push(`/projects/${projectId}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader
          title={initial ? "Editar configuração da aeronave" : "Configurar aeronave"}
          subtitle={`Projeto: ${projectName}`}
        />
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            {SECTIONS.map((section) => (
              <fieldset key={section.title}>
                <legend className="mb-3 text-sm font-semibold text-ink">{section.title}</legend>
                <div className="grid gap-4 sm:grid-cols-3">
                  {section.fields.map((f) => (
                    <div key={f.name}>
                      <Label htmlFor={f.name} hint={f.hint}>
                        {f.label}
                      </Label>
                      <Input id={f.name} type="number" step={f.step} {...register(f.name)} />
                      <FieldError message={errors[f.name]?.message as string | undefined} />
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}
            {error && <p className="text-sm text-alarm">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar configuração"}
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
