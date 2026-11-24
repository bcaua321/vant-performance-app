"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@/schemas/auth.schema";
import { Button, Card, CardBody, FieldError, Input, Label } from "@/components/ui";

/** Tela de nova senha, aberta pelo link com o token. */
function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  async function onSubmit(data: ResetPasswordInput) {
    setError(null);
    const res = await fetch("/api/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Falha ao redefinir a senha. Tente novamente.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <p className="text-sm">
        Senha redefinida.{" "}
        <Link href="/login" className="font-medium text-ink underline decoration-rule underline-offset-2 hover:decoration-ink">
          Entrar com a nova senha
        </Link>
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <input type="hidden" {...register("token")} />
      <div>
        <Label htmlFor="password" hint="Mínimo de 8 caracteres, com letras e números">
          Nova senha
        </Label>
        <Input id="password" type="password" {...register("password")} />
        <FieldError message={errors.password?.message ?? errors.token?.message} />
      </div>
      {error && <p className="text-sm text-alarm">{error}</p>}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Redefinir senha"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardBody>
        <h2 className="mb-4 text-lg font-semibold">Definir nova senha</h2>
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </CardBody>
    </Card>
  );
}
