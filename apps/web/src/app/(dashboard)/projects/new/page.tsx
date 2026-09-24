"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, type ProjectInput } from "@/schemas/project.schema";
import { Button, Card, CardBody, CardHeader, FieldError, Input, Label } from "@/components/ui";

/** RF004 — Criar projeto. */
export default function NewProjectPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProjectInput>({ resolver: zodResolver(projectSchema) });

  async function onSubmit(data: ProjectInput) {
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Falha ao criar projeto");
      return;
    }
    const project = await res.json();
    router.push(`/projects/${project.id}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader title="Novo projeto" subtitle="Um projeto agrupa a configuração da aeronave e suas análises" />
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="name">Nome do projeto</Label>
              <Input id="name" placeholder="Ex.: VANT Asa Fixa 2026" {...register("name")} />
              <FieldError message={errors.name?.message} />
            </div>
            <div>
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input id="description" placeholder="Objetivo da aeronave, missão, etc." {...register("description")} />
              <FieldError message={errors.description?.message} />
            </div>
            {error && <p className="text-sm text-alarm">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Criando..." : "Criar projeto"}
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
