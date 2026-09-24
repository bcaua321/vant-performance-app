import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireSession } from "@/lib/auth";
import { toErrorResponse } from "@/lib/api-utils";

const GRAPHS_DIR = process.env.GRAPHS_DIR ?? "/storage/graphs";

/** Serve os PNGs gerados pelo motor Python (volume compartilhado). */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    await requireSession();
    const { path: segments } = await params;
    const filePath = path.normalize(path.join(GRAPHS_DIR, ...segments));
    if (!filePath.startsWith(path.normalize(GRAPHS_DIR)) || !filePath.endsWith(".png")) {
      return NextResponse.json({ error: "Caminho inválido" }, { status: 400 });
    }
    const data = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=31536000" },
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Gráfico não encontrado" }, { status: 404 });
    }
    return toErrorResponse(err);
  }
}
