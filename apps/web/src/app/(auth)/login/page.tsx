"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/schemas/auth.schema";
import { Button, Card, CardBody, FieldError, Input, Label } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setError(null);
    const result = await signIn("credentials", { ...data, redirect: false });
    if (result?.error) {
      setError("E-mail ou senha incorretos.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <CardBody>
        <h2 className="mb-4 text-lg font-semibold">Entrar</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" placeholder="voce@exemplo.com" {...register("email")} />
            <FieldError message={errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" {...register("password")} />
            <FieldError message={errors.password?.message} />
          </div>
          {error && <p className="text-sm text-alarm">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          Não tem conta?{" "}
          <Link href="/register" className="font-medium text-ink underline decoration-rule underline-offset-2 hover:decoration-ink">
            Cadastre-se
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
