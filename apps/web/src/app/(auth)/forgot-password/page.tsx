"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/schemas/auth.schema";
import { Button, Card, CardBody, FieldError, Input, Label } from "@/components/ui";

/** Tela "Esqueci minha senha". */
export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(data: ForgotPasswordInput) {
    setError(null);
    const res = await fetch("/api/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Falha ao solicitar a recuperação. Tente novamente.");
      return;
    }
    setMessage(body.message);
  }

  return (
    <Card>
      <CardBody>
        <h2 className="mb-4 text-lg font-semibold">Recuperar senha</h2>
        {message ? (
          <p className="text-sm">{message}</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="email">E-mail da conta</Label>
              <Input id="email" type="email" placeholder="voce@exemplo.com" {...register("email")} />
              <FieldError message={errors.email?.message} />
            </div>
            {error && <p className="text-sm text-alarm">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "Enviar link de redefinição"}
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-ink underline decoration-rule underline-offset-2 hover:decoration-ink">
            Voltar para o login
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
