import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { projectService } from "@/services/project.service";
import { aircraftConfigSchema } from "@/schemas/aircraft.schema";
import { toErrorResponse } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const project = await projectService.getOwned(id, session.user!.id!);
    return NextResponse.json(project.config);
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** RF008 — Criar/editar configuracao de aeronave (upsert). */
export async function PUT(req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const input = aircraftConfigSchema.parse(await req.json());
    const config = await projectService.saveConfig(id, session.user!.id!, input);
    return NextResponse.json(config);
  } catch (err) {
    return toErrorResponse(err);
  }
}
