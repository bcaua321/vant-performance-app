import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { projectService } from "@/services/project.service";
import { projectSchema } from "@/schemas/project.schema";
import { toErrorResponse } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const project = await projectService.getOwned(id, session.user!.id!);
    return NextResponse.json(project);
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** RF006 — Editar projeto. */
export async function PUT(req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const input = projectSchema.parse(await req.json());
    const project = await projectService.update(id, session.user!.id!, input);
    return NextResponse.json(project);
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** RF007 — Excluir projeto (cascata em analises e configuracao). */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await projectService.delete(id, session.user!.id!);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
