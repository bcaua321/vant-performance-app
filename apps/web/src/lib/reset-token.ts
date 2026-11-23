import { createHash, randomBytes } from "node:crypto";

/**
 * RF003 — Recuperar senha.
 *
 * O token enviado ao usuario tem 32 bytes aleatorios (base64url). No banco
 * fica apenas o hash SHA-256, de modo que um vazamento da tabela nao permite
 * redefinir senhas. O token expira em 1 hora e vale para um unico uso.
 */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashResetToken(token) };
}

/** Token valido = existe, nao foi usado e ainda nao expirou. */
export function isResetTokenUsable(
  record: { expiresAt: Date; usedAt: Date | null } | null,
  now: Date = new Date(),
): boolean {
  return !!record && record.usedAt === null && record.expiresAt.getTime() > now.getTime();
}
