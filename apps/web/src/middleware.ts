import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/** Middleware de protecao de rotas (RNF011) — edge-safe, sem Prisma. */
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
