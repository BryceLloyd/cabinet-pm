"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { format, addDays } from "date-fns";
import type { CardProps } from "@/lib/dashboard/card-registry";

interface ProjectRow {
  id: string;
  name: string;
  client_name: string | null;
  estimated_completion_date: string;
  current_phase_id: string | null;
}

interface Phase {
  id: string;
  name: string;
  color: string;
}

export default function UpcomingDeadlinesCard({ userId }: CardProps) {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const now = new Date();
    const in14 = format(addDays(now, 14), "yyyy-MM-dd");
    const today = format(now, "yyyy-MM-dd");

    Promise.all([
      supabase
        .from("projects")
        .select("id, name, client_name, estimated_completion_date, current_phase_id")
        .in("status", ["planning", "active"])
        .gte("estimated_completion_date", today)
        .lte("estimated_completion_date", in14)
        .order("estimated_completion_date"),
      supabase.from("phases").select("id, name, color").is("archived_at", null),
    ]).then(([{ data: p }, { data: ph }]) => {
      setProjects((p as ProjectRow[]) || []);
      setPhases((ph as Phase[]) || []);
      setLoading(false);
    });
  }, [userId]);

  const phaseMap = new Map(phases.map((p) => [p.id, p]));

  return (
    <ul className="divide-y">
      {loading && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">Loading...</li>
      )}
      {!loading && projects.length === 0 && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">No deadlines in the next 14 days.</li>
      )}
      {projects.map((p) => {
        const phase = p.current_phase_id ? phaseMap.get(p.current_phase_id) : null;
        return (
          <li key={p.id} className="px-5 py-3">
            <Link href={`/projects/${p.id}`} className="block hover:opacity-70 transition-opacity">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.client_name && <>{p.client_name} · </>}
                    Due {format(new Date(p.estimated_completion_date), "MMM d")}
                  </div>
                </div>
                {phase && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                    style={{ backgroundColor: `${phase.color}20`, color: phase.color }}
                  >
                    {phase.name}
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
