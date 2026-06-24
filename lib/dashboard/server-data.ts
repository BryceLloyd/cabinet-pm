import { createClient } from "@/lib/supabase/server";
import { format, addDays } from "date-fns";

// Render-ready shapes for each dashboard card. Kept in sync with the matching
// client card components, which accept these as `initialData` and skip their
// own browser fetch when provided.
export interface MyTaskRow {
  id: string;
  title: string;
  due_date: string | null;
  project_id: string | null;
  projects: { name: string } | null;
  rooms: { name: string } | null;
  task_types: { name: string; color: string } | null;
}

export interface UpcomingEventRow {
  id: string;
  title: string;
  event_date: string;
  event_type_id: string | null;
  project_id: string | null;
  project_name: string | null;
  event_type_name: string | null;
  event_type_color: string;
}

export interface PhaseCount {
  phase: { id: string; name: string; color: string; sort_order: number };
  count: number;
}

export interface MemberLoad {
  id: string;
  name: string;
  count: number;
}

export interface PersonalTodoRow {
  id: string;
  title: string;
  completed_at: string | null;
  task_types: { name: string; color: string } | null;
}

export interface DashboardCardData {
  my_tasks: MyTaskRow[];
  upcoming_events: UpcomingEventRow[];
  projects_by_phase: PhaseCount[];
  team_workload: MemberLoad[];
  personal_todos: PersonalTodoRow[];
}

// Fetches everything the dashboard cards need in one parallel batch on the
// server, replacing the per-card browser fetch waterfall.
export async function getDashboardCardData(userId: string): Promise<DashboardCardData> {
  const supabase = await createClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const in14 = format(addDays(new Date(), 14), "yyyy-MM-dd");

  const [
    myTasksRes,
    eventsRes,
    phaseProjectsRes,
    phasesRes,
    workloadTasksRes,
    profilesRes,
    personalRes,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_date, project_id, projects(name), rooms(name), task_types(name, color)")
      .eq("assigned_to", userId)
      .is("completed_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from("calendar_events")
      .select("id, title, event_date, event_type_id, project_id, projects(name), event_types(name, color)")
      .gte("event_date", today)
      .lte("event_date", in14)
      .order("event_date")
      .limit(10),
    supabase.from("projects").select("current_phase_id").in("status", ["planning", "active"]),
    supabase.from("phases").select("id, name, color, sort_order").is("archived_at", null).order("sort_order"),
    supabase.from("tasks").select("assigned_to").is("completed_at", null).not("assigned_to", "is", null),
    supabase.from("profiles").select("id, full_name").is("deactivated_at", null),
    supabase
      .from("tasks")
      .select("id, title, completed_at, task_types(name, color)")
      .eq("assigned_to", userId)
      .is("project_id", null)
      .is("room_id", null)
      .is("completed_at", null)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  // Upcoming events: normalize to-one joins (Supabase types them as arrays).
  const upcoming_events: UpcomingEventRow[] = ((eventsRes.data as unknown[]) || []).map((raw) => {
    const ev = raw as {
      id: string;
      title: string;
      event_date: string;
      event_type_id: string | null;
      project_id: string | null;
      projects: { name: string } | { name: string }[] | null;
      event_types: { name: string; color: string } | { name: string; color: string }[] | null;
    };
    const proj = Array.isArray(ev.projects) ? ev.projects[0] : ev.projects;
    const et = Array.isArray(ev.event_types) ? ev.event_types[0] : ev.event_types;
    return {
      id: ev.id,
      title: ev.title,
      event_date: ev.event_date,
      event_type_id: ev.event_type_id,
      project_id: ev.project_id,
      project_name: proj?.name || null,
      event_type_name: et?.name || null,
      event_type_color: et?.color || "#94a3b8",
    };
  });

  // Projects by phase: count active projects per phase, drop empty phases.
  const phaseCounts = new Map<string, number>();
  ((phaseProjectsRes.data as { current_phase_id: string | null }[]) || []).forEach((p) => {
    if (p.current_phase_id) phaseCounts.set(p.current_phase_id, (phaseCounts.get(p.current_phase_id) || 0) + 1);
  });
  const projects_by_phase: PhaseCount[] = (
    (phasesRes.data as PhaseCount["phase"][]) || []
  )
    .map((phase) => ({ phase, count: phaseCounts.get(phase.id) || 0 }))
    .filter((r) => r.count > 0);

  // Team workload: open task count per active member, sorted desc.
  const loadCounts = new Map<string, number>();
  ((workloadTasksRes.data as { assigned_to: string | null }[]) || []).forEach((t) => {
    if (t.assigned_to) loadCounts.set(t.assigned_to, (loadCounts.get(t.assigned_to) || 0) + 1);
  });
  const profileMap = new Map(
    ((profilesRes.data as { id: string; full_name: string | null }[]) || []).map((p) => [p.id, p.full_name || "Unknown"])
  );
  const team_workload: MemberLoad[] = [];
  loadCounts.forEach((count, id) => {
    team_workload.push({ id, name: profileMap.get(id) || "Unknown", count });
  });
  team_workload.sort((a, b) => b.count - a.count);

  return {
    my_tasks: (myTasksRes.data as unknown as MyTaskRow[]) || [],
    upcoming_events,
    projects_by_phase,
    team_workload,
    personal_todos: (personalRes.data as unknown as PersonalTodoRow[]) || [],
  };
}
