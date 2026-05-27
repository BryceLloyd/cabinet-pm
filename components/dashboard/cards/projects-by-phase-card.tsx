"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CardProps } from "@/lib/dashboard/card-registry";

interface Phase {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

export default function ProjectsByPhaseCard({ userId }: CardProps) {
  const [phaseCounts, setPhaseCounts] = useState<{ phase: Phase; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from("projects")
        .select("current_phase_id")
        .in("status", ["planning", "active"]),
      supabase.from("phases").select("id, name, color, sort_order").is("archived_at", null).order("sort_order"),
    ]).then(([{ data: projects }, { data: phases }]) => {
      const counts = new Map<string, number>();
      (projects || []).forEach((p) => {
        if (p.current_phase_id) {
          counts.set(p.current_phase_id, (counts.get(p.current_phase_id) || 0) + 1);
        }
      });
      const result = (phases || [])
        .map((phase) => ({ phase, count: counts.get(phase.id) || 0 }))
        .filter((r) => r.count > 0);
      setPhaseCounts(result);
      setLoading(false);
    });
  }, [userId]);

  const maxCount = Math.max(...phaseCounts.map((r) => r.count), 1);

  return (
    <div className="px-5 py-4 space-y-3">
      {loading && (
        <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
      )}
      {!loading && phaseCounts.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4">No active projects.</div>
      )}
      {phaseCounts.map(({ phase, count }) => (
        <div key={phase.id} className="flex items-center gap-3">
          <span className="text-xs font-medium w-20 truncate" style={{ color: phase.color }}>
            {phase.name}
          </span>
          <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max((count / maxCount) * 100, 8)}%`,
                backgroundColor: phase.color,
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums w-6 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
}
