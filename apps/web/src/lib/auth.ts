import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
});

/** Retorna a sessao autenticada ou lanca 401 (uso em route handlers). */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw Object.assign(new Error("Não autenticado"), { status: 401 });
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if ((session.user as { role?: string }).role !== "ADMIN") {
    throw Object.assign(new Error("Acesso restrito a administradores"), { status: 403 });
  }
  return session;
}
