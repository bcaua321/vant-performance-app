import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/schemas/auth.schema";
import { toErrorResponse } from "@/lib/api-utils";

/** RF001 — Cadastrar usuario. Hash bcrypt com custo 12 (RNF012). */
export async function POST(req: Request) {
  try {
    const input = registerSchema.parse(await req.json());
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
    }
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
      },
      select: { id: true, name: true, email: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
