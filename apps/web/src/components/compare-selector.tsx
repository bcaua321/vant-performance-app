"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, StatusBadge } from "@/components/ui";

interface AnalysisRow {
  id: string;
  status: string;
  altitude: number;
  propeller: string;
  motor: string;
  createdAt: string;
}

/** Tabela de analises com selecao para comparacao (RF014). */
export function CompareSelector({ projectId, analyses }: { projectId: string; analyses: AnalysisRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev,
    );
  }

  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-muted">
            <th className="py-2 pr-2"></th>
            <th className="py-2 pr-4">Hélice</th>
            <th className="py-2 pr-4">Motor</th>
            <th className="py-2 pr-4">Altitude</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Criada em</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {analyses.map((a) => (
            <tr key={a.id} className="border-b border-hairline hover:bg-paper">
              <td className="py-2 pr-2">
                <input
                  type="checkbox"
                  disabled={a.status !== "DONE"}
                  checked={selected.includes(a.id)}
                  onChange={() => toggle(a.id)}
                />
              </td>
              <td className="py-2 pr-4">{a.propeller}</td>
              <td className="py-2 pr-4">{a.motor}</td>
              <td className="py-2 pr-4">{a.altitude} m</td>
              <td className="py-2 pr-4"><StatusBadge status={a.status} /></td>
              <td className="py-2 pr-4">{new Date(a.createdAt).toLocaleString("pt-BR")}</td>
              <td className="py-2 text-right">
                <Link href={`/projects/${projectId}/analyses/${a.id}`} className="text-ink underline decoration-rule underline-offset-2 hover:decoration-ink">
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected.length >= 2 && (
        <Button onClick={() => router.push(`/projects/${projectId}/compare?ids=${selected.join(",")}`)}>
          Comparar {selected.length} análises
        </Button>
      )}
    </div>
  );
}
