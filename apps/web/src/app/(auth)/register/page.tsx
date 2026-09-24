"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/schemas/auth.schema";
import { Button, Card, CardBody, FieldError, Input, Label } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(data: RegisterInput) {
    setError(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Falha no cadastro. Tente novamente.");
      return;
    }
    await signIn("credentials", { email: data.email, password: data.password, redirect: false });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <CardBody>
        <h2 className="mb-4 text-lg font-semibold">Criar conta</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" {...register("name")} />
            <FieldError message={errors.name?.message} />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" placeholder="voce@exemplo.com" {...register("email")} />
            <FieldError message={errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="password" hint="Mínimo de 8 caracteres, com letras e números">Senha</Label>
            <Input id="password" type="password" {...register("password")} />
            <FieldError message={errors.password?.message} />
          </div>
          {error && <p className="text-sm text-alarm">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Criando..." : "Criar conta"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-ink underline decoration-rule underline-offset-2 hover:decoration-ink">
            Entrar
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
