import { addDays, differenceInDays, isWeekend, parseISO } from "date-fns";
import type { Phase, RoomGroup } from "@/lib/types";

/**
 * Skip weekends: advance date forward until it lands on a weekday.
 */
function nextWeekday(date: Date): Date {
  let d = new Date(date);
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

/**
 * Count working days (Mon-Fri) between two dates inclusive.
 */
function workingDaysBetween(start: Date, end: Date): number {
  let count = 0;
  let d = new Date(start);
  while (d <= end) {
    if (!isWeekend(d)) count++;
    d = addDays(d, 1);
  }
  return count;
}

export interface AutoFillEntry {
  room_group_id: string | null;
  project_id: string | null;
  phase_id: string;
  start_date: string; // ISO date
  end_date: string;   // ISO date
}

/**
 * Generate phase plan entries by distributing phases equally across the project timeline.
 * Creates one set of entries per target (each room group, or project-level if no groups).
 *
 * @param projectStart - ISO date string for project start
 * @param projectEnd - ISO date string for estimated completion
 * @param phases - Active phases sorted by sort_order
 * @param groups - Room groups for this project (may be empty)
 * @param projectId - Project ID (used for project-level fallback)
 */
export function autoFillPhasePlans(
  projectStart: string,
  projectEnd: string,
  phases: Phase[],
  groups: RoomGroup[],
  projectId: string
): AutoFillEntry[] {
  if (phases.length === 0) return [];

  const start = parseISO(projectStart);
  const end = parseISO(projectEnd);
  const totalDays = Math.max(1, differenceInDays(end, start) + 1);
  const daysPerPhase = Math.floor(totalDays / phases.length);
  const remainder = totalDays - daysPerPhase * phases.length;

  // Targets: one set per group, plus project-level if no groups or ungrouped rooms exist
  const targets: { room_group_id: string | null; project_id: string | null }[] =
    groups.length > 0
      ? groups.map((g) => ({ room_group_id: g.id, project_id: null }))
      : [{ room_group_id: null, project_id: projectId }];

  const entries: AutoFillEntry[] = [];

  for (const target of targets) {
    let cursor = new Date(start);

    phases.forEach((phase, i) => {
      const phaseStart = nextWeekday(cursor);
      const phaseDays = daysPerPhase + (i < remainder ? 1 : 0);
      // Advance by phaseDays calendar days, then back up to land on a weekday
      let phaseEnd = addDays(phaseStart, Math.max(0, phaseDays - 1));
      while (isWeekend(phaseEnd)) phaseEnd = addDays(phaseEnd, -1);
      // Edge case: if phaseEnd < phaseStart, just use phaseStart
      if (phaseEnd < phaseStart) phaseEnd = phaseStart;

      entries.push({
        room_group_id: target.room_group_id,
        project_id: target.project_id,
        phase_id: phase.id,
        start_date: phaseStart.toISOString().split("T")[0],
        end_date: phaseEnd.toISOString().split("T")[0],
      });

      cursor = addDays(phaseEnd, 1);
    });
  }

  return entries;
}
