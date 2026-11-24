import { describe, expect, it } from "vitest";
import { RESET_TOKEN_TTL_MS, generateResetToken, hashResetToken, isResetTokenUsable } from "./reset-token";

describe("token de recuperação de senha", () => {
  it("gera token de 32 bytes e guarda só o hash SHA-256", () => {
    const { token, tokenHash } = generateResetToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashResetToken(token));
    expect(tokenHash).not.toContain(token);
  });

  it("gera tokens diferentes a cada pedido", () => {
    expect(generateResetToken().token).not.toBe(generateResetToken().token);
  });

  it("aceita token dentro da validade de 1 hora e ainda não usado", () => {
    const now = new Date("2026-11-23T12:00:00Z");
    const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);
    expect(isResetTokenUsable({ expiresAt, usedAt: null }, now)).toBe(true);
  });

  it("recusa token expirado, já usado ou inexistente", () => {
    const now = new Date("2026-11-23T12:00:00Z");
    expect(isResetTokenUsable({ expiresAt: new Date(now.getTime() - 1), usedAt: null }, now)).toBe(false);
    expect(isResetTokenUsable({ expiresAt: now, usedAt: null }, now)).toBe(false);
    expect(
      isResetTokenUsable({ expiresAt: new Date(now.getTime() + 1000), usedAt: new Date(now) }, now),
    ).toBe(false);
    expect(isResetTokenUsable(null, now)).toBe(false);
  });
});
