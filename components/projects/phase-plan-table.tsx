"use client";

import { useState, useRef, useCallback } from "react";

import { createClient } from "@/lib/supabase/client";
import type { PhasePlan, Phase, RoomGroup } from "@/lib/types";

interface Props {
  plans: PhasePlan[];
  phases: Phase[];
  groups: RoomGroup[];
  onUpdate: (updated: PhasePlan[]) => void;
}

export function PhasePlanTable({ plans, phases, groups, onUpdate }: Props) {
  const supabase = createClient();
  const [localPlans, setLocalPlans] = useState(plans);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const phaseMap = new Map(phases.map((p) => [p.id, p]));

  // Rows: one per group, or one "Project" row
  const rows: { id: string; label: string; isProject: boolean }[] =
    groups.length > 0
      ? groups.map((g) => ({ id: g.id, label: g.name, isProject: false }))
      : [{ id: "__project__", label: "Project", isProject: true }];

  const debouncedSave = useCallback(
    (planId: string, field: "start_date" | "end_date", value: string) => {
      if (saveTimers.current[planId]) clearTimeout(saveTimers.current[planId]);
      saveTimers.current[planId] = setTimeout(async () => {
        await supabase
          .from("phase_plans")
          .update({ [field]: value, updated_at: new Date().toISOString() })
          .eq("id", planId);
      }, 800);
    },
    [supabase]
  );

  function handleDateChange(planId: string, field: "start_date" | "end_date", value: string) {
    const updated = localPlans.map((p) =>
      p.id === planId ? { ...p, [field]: value } : p
    );
    setLocalPlans(updated);
    onUpdate(updated);
    debouncedSave(planId, field, value);
  }

  function hasOverlap(rowId: string, planId: string, start: string, end: string): boolean {
    const rowPlans = localPlans.filter((p) =>
      rowId === "__project__" ? p.project_id !== null : p.room_group_id === rowId
    );
    return rowPlans.some((p) => {
      if (p.id === planId) return false;
      return p.start_date <= end && p.end_date >= start;
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left px-3 py-2 font-medium">Group</th>
            <th className="text-left px-3 py-2 font-medium">Phase</th>
            <th className="text-left px-3 py-2 font-medium">Start</th>
            <th className="text-left px-3 py-2 font-medium">End</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowPlans = localPlans
              .filter((p) =>
                row.isProject ? p.project_id !== null : p.room_group_id === row.id
              )
              .sort((a, b) => {
                const phaseA = phaseMap.get(a.phase_id);
                const phaseB = phaseMap.get(b.phase_id);
                return (phaseA?.sort_order ?? 0) - (phaseB?.sort_order ?? 0);
              });

            return rowPlans.map((plan, j) => {
              const phase = phaseMap.get(plan.phase_id);
              const overlap = hasOverlap(row.id, plan.id, plan.start_date, plan.end_date);
              const outOfOrder =
                plan.start_date > plan.end_date;

              return (
                <tr key={plan.id} className="border-b">
                  {j === 0 && (
                    <td className="px-3 py-2 font-medium align-top" rowSpan={rowPlans.length}>
                      {row.label}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: phase?.color || "#94a3b8" }}
                      />
                      {phase?.name || "Unknown"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={plan.start_date}
                      onChange={(e) => handleDateChange(plan.id, "start_date", e.target.value)}
                      className={`h-7 px-2 text-xs rounded-md border bg-background ${
                        overlap || outOfOrder ? "border-yellow-500" : ""
                      }`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={plan.end_date}
                      onChange={(e) => handleDateChange(plan.id, "end_date", e.target.value)}
                      className={`h-7 px-2 text-xs rounded-md border bg-background ${
                        overlap || outOfOrder ? "border-yellow-500" : ""
                      }`}
                    />
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground px-3 py-2">
        Yellow borders indicate overlapping or out-of-order dates. Changes save automatically.
      </p>
    </div>
  );
}
