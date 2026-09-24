import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { projectService } from "@/services/project.service";
import { catalogRepository } from "@/repositories/catalog.repository";
import { AnalysisForm } from "@/components/analysis-form";

/** RF011 — Criar analise: selecao de helice, motor e altitude. */
export default async function NewAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  let project;
  try {
    project = await projectService.getOwned(id, session.user.id);
  } catch {
    notFound();
  }
  if (!project.config) redirect(`/projects/${id}/aircraft`);

  const [propellers, motors] = await Promise.all([
    catalogRepository.listPropellers(),
    catalogRepository.listMotors(),
  ]);

  return (
    <AnalysisForm
      projectId={project.id}
      projectName={project.name}
      propellers={propellers.map((p) => ({
        id: p.id,
        name: p.name,
        diameter: p.diameter,
        pitch: p.pitch,
        hasData: !!p.dataFilePath,
      }))}
      motors={motors.map((m) => ({ id: m.id, name: m.name, kvRating: m.kvRating, maxPower: m.maxPower }))}
    />
  );
}
