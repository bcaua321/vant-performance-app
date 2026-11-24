import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  RESET_TOKEN_TTL_MS,
  generateResetToken,
  hashResetToken,
  isResetTokenUsable,
} from "@/lib/reset-token";

/**
 * Entrega do link. Nao ha servidor de e-mail configurado no projeto, entao o
 * link e registrado no log do servidor.
 * ponytail: log no console; trocar por um provedor SMTP/transacional para producao.
 */
function deliverResetLink(email: string, url: string): void {
  console.info(`[recuperar-senha] Link de redefinição de senha para ${email}: ${url}`);
}

/**
 * Gera o token e entrega o link. Se o e-mail nao existir, nao faz nada: a
 * resposta ao cliente e a mesma nos dois casos, para nao revelar quais
 * e-mails estao cadastrados.
 */
export async function requestPasswordReset(email: string, baseUrl: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;

  const { token, tokenHash } = generateResetToken();
  await prisma.$transaction([
    // Um pedido novo invalida os links anteriores ainda nao usados.
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    }),
  ]);

  const url = new URL("/reset-password", baseUrl);
  url.searchParams.set("token", token);
  deliverResetLink(email, url.toString());
}

/** Valida o token e grava a nova senha. Retorna false se o token for invalido. */
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
  });
  if (!record || !isResetTokenUsable(record)) return false;

  const passwordHash = await bcrypt.hash(newPassword, 12); // mesmo custo usado no cadastro
  // Marca o token como usado antes de trocar a senha, na mesma transacao:
  // se outra requisicao ja o consumiu (count 0), nada e alterado.
  return prisma.$transaction(async (tx) => {
    const used = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count === 0) return false;
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    return true;
  });
}
