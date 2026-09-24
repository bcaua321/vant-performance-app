import type { NextAuthConfig } from "next-auth";

/**
 * Configuracao base do Auth.js compartilhada com o middleware (edge-safe:
 * sem Prisma nem bcrypt). Sessao via JWT com validade de 7 dias (RF002).
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 dias
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      // Rotas de API aplicam autenticacao nos proprios handlers e devem
      // responder 401 JSON, nao redirecionar para a tela de login (RNF019).
      if (pathname.startsWith("/api/")) return true;
      const isPublic =
        pathname === "/" ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/register") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/reset-password");
      if (isPublic) return true;
      return isLoggedIn;
    },
  },
  providers: [], // preenchido em auth.ts (Node runtime)
} satisfies NextAuthConfig;
