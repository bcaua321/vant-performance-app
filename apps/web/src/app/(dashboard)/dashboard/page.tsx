import Link from "next/link";
import { auth } from "@/lib/auth";
import { projectService } from "@/services/project.service";
import { Button, Card, CardBody, CardHeader } from "@/components/ui";

/** RF005 — Dashboard com lista de projetos do usuario. */
export default async function DashboardPage() {
  const session = await auth();
  const projects = await projectService.listByUser(session!.user!.id!);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Meus projetos</h1>
        <Link href="/projects/new">
          <Button>Novo projeto</Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center text-muted">
            <p className="mb-3">Você ainda não tem projetos.</p>
            <Link href="/projects/new">
              <Button variant="outline">Criar o primeiro projeto</Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader title={p.name} subtitle={p.description ?? undefined} />
                <CardBody className="flex items-center justify-between text-sm text-muted">
                  <span>{p._count.analyses} análise(s)</span>
                  <span>{p.config ? "Aeronave configurada" : "Sem configuração"}</span>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
