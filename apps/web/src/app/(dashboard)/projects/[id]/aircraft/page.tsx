import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { projectService } from "@/services/project.service";
import { AircraftForm } from "@/components/aircraft-form";

/** RF008 — Configuracao da aeronave do projeto. */
export default async function AircraftConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  let project;
  try {
    project = await projectService.getOwned(id, session.user.id);
  } catch {
    notFound();
  }

  return (
    <AircraftForm
      projectId={project.id}
      projectName={project.name}
      initial={
        project.config
          ? {
              wingspan: project.config.wingspan,
              chord: project.config.chord,
              area: project.config.area,
              clMax: project.config.clMax,
              cd0: project.config.cd0,
              oswald: project.config.oswald,
              loadFactor: project.config.loadFactor,
              emptyWeight: project.config.emptyWeight,
              payload: project.config.payload,
              batteryCapacity: project.config.batteryCapacity,
              batteryVoltage: project.config.batteryVoltage,
              batteryCells: project.config.batteryCells,
              etaEsc: project.config.etaEsc,
              etaMotor: project.config.etaMotor,
              etaProp: project.config.etaProp,
            }
          : null
      }
    />
  );
}
