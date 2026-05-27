"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProjectGantt } from "@/components/projects/project-gantt";
import { PhasePlanTable } from "@/components/projects/phase-plan-table";
import { autoFillPhasePlans } from "@/lib/phase-plans";
import type { Phase, PhasePlan, RoomGroup } from "@/lib/types";

interface Props {
  projectId: string;
  projectStart: string;
  projectEnd: string;
  phases: Phase[];
  groups: RoomGroup[];
}

export function PlanningSection({ projectId, projectStart, projectEnd, phases, groups }: Props) {
  const supabase = createClient();
  const [plans, setPlans] = useState<PhasePlan[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlans = useCallback(async () => {
    // Fetch existing plans for this project's groups + project-level fallback
    const groupIds = groups.map((g) => g.id);
    let allPlans: PhasePlan[] = [];

    if (groupIds.length > 0) {
      const { data } = await supabase
        .from("phase_plans")
        .select("*")
        .in("room_group_id", groupIds);
      if (data) allPlans = [...allPlans, ...(data as PhasePlan[])];
    }

    // Also fetch project-level plans
    const { data: projectPlans } = await supabase
      .from("phase_plans")
      .select("*")
      .eq("project_id", projectId)
      .is("room_group_id", null);
    if (projectPlans) allPlans = [...allPlans, ...(projectPlans as PhasePlan[])];

    return allPlans;
  }, [supabase, groups, projectId]);

  useEffect(() => {
    (async () => {
      let existing = await loadPlans();

      // Auto-fill if no plans exist
      if (existing.length === 0 && phases.length > 0) {
        const entries = autoFillPhasePlans(projectStart, projectEnd, phases, groups, projectId);
        if (entries.length > 0) {
          const { data } = await supabase
            .from("phase_plans")
            .insert(entries)
            .select("*");
          if (data) existing = data as PhasePlan[];
        }
      }

      setPlans(existing);
      setLoading(false);
    })();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Planning</h2>
        </div>
        <div className="px-5 py-8 text-sm text-muted-foreground text-center animate-pulse">
          Loading phase plans…
        </div>
      </section>
    );
  }

  if (plans.length === 0) {
    return (
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Planning</h2>
        </div>
        <div className="px-5 py-8 text-sm text-muted-foreground text-center">
          No phases configured. Add phases in Settings → Phases to enable planning.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3.5 border-b">
        <h2 className="font-medium">Planning</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Phase schedule per room group. Edit dates in the table below.
        </p>
      </div>
      <div className="px-5 py-4">
        <ProjectGantt
          projectStart={projectStart}
          projectEnd={projectEnd}
          groups={groups}
          phasePlans={plans}
          phases={phases}
        />
      </div>
      <div className="border-t">
        <PhasePlanTable
          plans={plans}
          phases={phases}
          groups={groups}
          onUpdate={setPlans}
        />
      </div>
    </section>
  );
}
