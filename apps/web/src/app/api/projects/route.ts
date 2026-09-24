import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { projectService } from "@/services/project.service";
import { projectSchema } from "@/schemas/project.schema";
import { toErrorResponse } from "@/lib/api-utils";

/** RF005 — Listar projetos do usuario autenticado. */
export async function GET() {
  try {
    const session = await requireSession();
    const projects = await projectService.listByUser(session.user!.id!);
    return NextResponse.json(projects);
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** RF004 — Criar projeto. */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const input = projectSchema.parse(await req.json());
    const project = await projectService.create(session.user!.id!, input);
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
