import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { projectService } from "@/services/project.service";
import { Button, Card, CardBody, CardHeader } from "@/components/ui";
import { CompareSelector } from "@/components/compare-selector";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{project.name}</h1>
          {project.description && <p className="text-sm text-muted">{project.description}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/projects/${project.id}/aircraft`}>
            <Button variant="outline">{project.config ? "Editar aeronave" : "Configurar aeronave"}</Button>
          </Link>
          <Link href={`/projects/${project.id}/analyses/new`}>
            <Button disabled={!project.config}>Nova análise</Button>
          </Link>
        </div>
      </div>

      {project.config && (
        <Card>
          <CardHeader title="Configuração da aeronave" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <div><dt className="text-muted">Envergadura</dt><dd className="font-medium">{project.config.wingspan} m</dd></div>
              <div><dt className="text-muted">Área alar</dt><dd className="font-medium">{project.config.area} m²</dd></div>
              <div><dt className="text-muted">CL máx</dt><dd className="font-medium">{project.config.clMax}</dd></div>
              <div><dt className="text-muted">CD0</dt><dd className="font-medium">{project.config.cd0}</dd></div>
              <div><dt className="text-muted">Peso vazio</dt><dd className="font-medium">{project.config.emptyWeight} kg</dd></div>
              <div><dt className="text-muted">Carga paga</dt><dd className="font-medium">{project.config.payload} kg</dd></div>
              <div><dt className="text-muted">Bateria</dt><dd className="font-medium">{project.config.batteryCapacity} mAh / {project.config.batteryVoltage} V</dd></div>
              <div><dt className="text-muted">Células</dt><dd className="font-medium">{project.config.batteryCells}S</dd></div>
            </dl>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Análises"
          subtitle={
            project.analyses.length >= 2
              ? "Selecione 2 a 4 análises concluídas para comparar"
              : undefined
          }
        />
        <CardBody>
          {project.analyses.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Nenhuma análise ainda. {project.config ? "Crie a primeira!" : "Configure a aeronave para começar."}
            </p>
          ) : (
            <CompareSelector
              projectId={project.id}
              analyses={project.analyses.map((a) => ({
                id: a.id,
                status: a.status,
                altitude: a.altitude,
                propeller: a.propeller.name,
                motor: a.motor.name,
                createdAt: a.createdAt.toISOString(),
              }))}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
