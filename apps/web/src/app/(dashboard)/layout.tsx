import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-panel">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <nav className="flex items-baseline gap-6">
            <Link href="/dashboard" className="text-[0.9375rem] font-semibold tracking-tight text-ink">
              VANT<span className="text-signal">·</span>Performance
            </Link>
            <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
              Projetos
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted sm:inline">{session.user.name}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button variant="ghost" type="submit">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
