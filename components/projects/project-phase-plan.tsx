"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addDays,
  addMonths,
  differenceInDays,
  format,
  parseISO,
  startOfMonth,
  subDays,
} from "date-fns";
import type { Phase, PhasePlan } from "@/lib/types";

interface Props {
  projectId: string;
  projectStart: string;
  projectEnd: string;
  phases: Phase[];
}

interface DisplayPlan {
  id: string;
  phase_id: string;
  days: number;
  start_date: string;
  end_date: string;
}

export function ProjectPhasePlan({ projectId, projectStart, projectEnd, phases }: Props) {
  const supabase = createClient();
  const [plans, setPlans] = useState<PhasePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const start = parseISO(projectStart);
  const end = parseISO(projectEnd);
  const totalDays = Math.max(1, differenceInDays(end, start) + 1);

  const phaseMap = useMemo(() => new Map(phases.map((p) => [p.id, p])), [phases]);

  // Generate plans working backwards from completion date using default durations
  const generatePlans = useCallback((): Omit<PhasePlan, "id" | "created_at" | "updated_at">[] => {
    if (phases.length === 0) return [];

    const entries: Omit<PhasePlan, "id" | "created_at" | "updated_at">[] = [];
    let cursor = new Date(end);

    // Work backwards: last phase ends on completion date
    for (let i = phases.length - 1; i >= 0; i--) {
      const phase = phases[i];
      const days = phase.default_duration_days ?? Math.max(1, Math.floor(totalDays / phases.length));
      const phaseEnd = new Date(cursor);
      const phaseStart = subDays(phaseEnd, days - 1);

      entries.push({
        room_group_id: null,
        project_id: projectId,
        phase_id: phase.id,
        start_date: format(phaseStart, "yyyy-MM-dd"),
        end_date: format(phaseEnd, "yyyy-MM-dd"),
        is_default: true,
      });

      cursor = subDays(phaseStart, 1);
    }

    return entries;
  }, [phases, end, totalDays, projectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: existing } = await supabase
        .from("phase_plans")
        .select("*")
        .eq("project_id", projectId)
        .is("room_group_id", null);

      if (cancelled) return;

      if (existing && existing.length > 0) {
        const seen = new Set<string>();
        const deduped = (existing as PhasePlan[]).filter((p) => {
          if (seen.has(p.phase_id)) return false;
          seen.add(p.phase_id);
          return true;
        });
        setPlans(deduped);
      } else if (phases.length > 0) {
        const entries = generatePlans();
        if (entries.length > 0) {
          const { data } = await supabase
            .from("phase_plans")
            .insert(entries)
            .select("*");
          if (!cancelled && data) setPlans(data as PhasePlan[]);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute contiguous layout working BACKWARDS from completion date
  const displayPlans: DisplayPlan[] = useMemo(() => {
    const activePlans = plans.filter((p) => phaseMap.has(p.phase_id));
    const sorted = [...activePlans].sort((a, b) => {
      const pa = phaseMap.get(a.phase_id);
      const pb = phaseMap.get(b.phase_id);
      return (pa?.sort_order ?? 0) - (pb?.sort_order ?? 0);
    });

    // Work backwards from completion date
    let cursor = new Date(end);
    const result: DisplayPlan[] = [];

    for (let i = sorted.length - 1; i >= 0; i--) {
      const plan = sorted[i];
      const days = Math.max(1, differenceInDays(parseISO(plan.end_date), parseISO(plan.start_date)) + 1);
      const e = new Date(cursor);
      const s = subDays(e, days - 1);
      cursor = subDays(s, 1);

      result.unshift({
        id: plan.id,
        phase_id: plan.phase_id,
        days,
        start_date: format(s, "yyyy-MM-dd"),
        end_date: format(e, "yyyy-MM-dd"),
      });
    }

    return result;
  }, [plans, end, phaseMap]);

  function handleDurationChange(planId: string, newDays: number) {
    if (newDays < 1) return;

    setPlans((prev) => {
      const active = prev.filter((p) => phaseMap.has(p.phase_id));
      const inactive = prev.filter((p) => !phaseMap.has(p.phase_id));
      const sorted = [...active].sort((a, b) => {
        const pa = phaseMap.get(a.phase_id);
        const pb = phaseMap.get(b.phase_id);
        return (pa?.sort_order ?? 0) - (pb?.sort_order ?? 0);
      });

      const idx = sorted.findIndex((p) => p.id === planId);
      if (idx === -1) return prev;

      // Recalculate all plans backwards from completion date
      let cursor = new Date(end);
      const updated: PhasePlan[] = [];

      for (let i = sorted.length - 1; i >= 0; i--) {
        const plan = sorted[i];
        const days = plan.id === planId
          ? newDays
          : Math.max(1, differenceInDays(parseISO(plan.end_date), parseISO(plan.start_date)) + 1);
        const e = new Date(cursor);
        const s = subDays(e, days - 1);
        cursor = subDays(s, 1);

        updated.unshift({
          ...plan,
          start_date: format(s, "yyyy-MM-dd"),
          end_date: format(e, "yyyy-MM-dd"),
          is_default: plan.id === planId ? false : plan.is_default,
        });
      }

      // Save changed plans
      for (const p of updated) {
        const orig = sorted.find((o) => o.id === p.id);
        if (orig && (orig.start_date !== p.start_date || orig.end_date !== p.end_date || orig.is_default !== p.is_default)) {
          if (saveTimers.current[p.id]) clearTimeout(saveTimers.current[p.id]);
          saveTimers.current[p.id] = setTimeout(async () => {
            await supabase
              .from("phase_plans")
              .update({ start_date: p.start_date, end_date: p.end_date, is_default: p.is_default })
              .eq("id", p.id);
          }, 800);
        }
      }

      return [...updated, ...inactive];
    });
  }

  if (loading) {
    return <div className="py-4 text-sm text-muted-foreground text-center animate-pulse">Loading…</div>;
  }

  if (displayPlans.length === 0) {
    return (
      <div className="py-4 text-sm text-muted-foreground text-center">
        No phases configured. Add phases in Settings to enable planning.
      </div>
    );
  }

  // 4-month Gantt range: start from the month the project starts
  const ganttStart = startOfMonth(start);
  const ganttEnd = subDays(addMonths(ganttStart, 4), 1);
  const ganttDays = differenceInDays(ganttEnd, ganttStart) + 1;

  const months = Array.from({ length: 4 }, (_, i) => {
    const m = addMonths(ganttStart, i);
    const mEnd = subDays(addMonths(m, 1), 1);
    return { start: m, end: mEnd, label: format(m, "MMMM yyyy") };
  });

  const today = new Date();
  const todayInGantt = today >= ganttStart && today <= ganttEnd;

  function ganttPct(date: Date) {
    return (differenceInDays(date, ganttStart) / ganttDays) * 100;
  }

  return (
    <div className="space-y-4">
      {/* 4-month Gantt */}
      <div className="space-y-0">
        {/* Month headers */}
        <div className="relative h-6 flex">
          {months.map((m, i) => {
            const left = ganttPct(m.start);
            const width = ((differenceInDays(m.end, m.start) + 1) / ganttDays) * 100;
            return (
              <div
                key={i}
                className="absolute top-0 h-full flex items-end px-1.5 border-l border-border first:border-l-0"
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                <span className="text-[10px] font-medium text-muted-foreground truncate">
                  {format(m.start, "MMM yyyy")}
                </span>
              </div>
            );
          })}
        </div>

        {/* Gantt bar area */}
        <div className="relative h-8 rounded-md border border-border bg-muted/30 overflow-hidden">
          {/* Month dividers */}
          {months.slice(1).map((m, i) => (
            <div
              key={i}
              className="absolute top-0 h-full border-l border-border/50"
              style={{ left: `${ganttPct(m.start)}%` }}
            />
          ))}

          {/* Lead time background bar */}
          <div
            className="absolute top-1 bottom-1 rounded bg-muted/80"
            style={{
              left: `${Math.max(0, ganttPct(start))}%`,
              width: `${Math.min(100, (totalDays / ganttDays) * 100)}%`,
            }}
          />

          {/* Phase overlay — thin strip at bottom of the lead time bar */}
          <div
            className="absolute bottom-1 h-1.5 flex"
            style={{
              left: `${Math.max(0, ganttPct(parseISO(displayPlans[0]?.start_date ?? projectStart)))}%`,
              right: `${100 - Math.min(100, ganttPct(parseISO(displayPlans[displayPlans.length - 1]?.end_date ?? projectEnd)) + 0.3)}%`,
            }}
          >
            {displayPlans.map((dp) => {
              const phase = phaseMap.get(dp.phase_id);
              if (!phase) return null;
              return (
                <div
                  key={dp.id}
                  className="h-full first:rounded-l last:rounded-r"
                  style={{
                    flex: dp.days,
                    backgroundColor: phase.color,
                  }}
                  title={`${phase.name}: ${format(parseISO(dp.start_date), "d MMM")} – ${format(parseISO(dp.end_date), "d MMM")}`}
                />
              );
            })}
          </div>

          {/* Today marker */}
          {todayInGantt && (
            <div
              className="absolute top-0 h-full w-px bg-red-500"
              style={{ left: `${ganttPct(today)}%` }}
              title={`Today: ${format(today, "d MMM")}`}
            />
          )}
        </div>
      </div>

      {/* Phase duration list */}
      <div className="divide-y">
        {displayPlans.map((dp) => {
          const phase = phaseMap.get(dp.phase_id);
          if (!phase) return null;
          const dpStart = parseISO(dp.start_date);
          const dpEnd = parseISO(dp.end_date);

          return (
            <div key={dp.id} className="flex items-center gap-3 py-2">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: phase.color }}
              />
              <span className="text-sm font-medium min-w-0 flex-1 truncate">{phase.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="number"
                  min={1}
                  value={dp.days}
                  onChange={(e) => handleDurationChange(dp.id, parseInt(e.target.value) || 1)}
                  className="w-14 h-7 px-2 text-xs text-center rounded-md border bg-background [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {format(dpStart, "d MMM")} – {format(dpEnd, "d MMM")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
