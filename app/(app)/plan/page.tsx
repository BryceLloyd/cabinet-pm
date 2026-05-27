import { createClient } from "@/lib/supabase/server";
import { YearPlanView } from "@/components/plan/year-plan-view";
import type { PhasePlan, CalendarEvent, EventType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; view?: string }>;
}) {
  const params = await searchParams;
  const year = params.year ? parseInt(params.year, 10) : new Date().getFullYear();
  const view = (params.view === "calendar" ? "calendar" : "gantt") as "gantt" | "calendar";

  const supabase = await createClient();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: projects },
    { data: phases },
    { data: roomGroups },
    { data: phasePlans },
    { data: userPrefs },
    { data: calendarEvents },
    { data: eventTypes },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .neq("status", "cancelled")
      .lte("start_date", yearEnd)
      .gte("estimated_completion_date", yearStart)
      .order("estimated_completion_date"),
    supabase.from("phases").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("room_groups").select("*").order("sort_order"),
    supabase.from("phase_plans").select("id, room_group_id, project_id, phase_id, start_date, end_date"),
    supabase.from("profiles").select("show_room_groups").eq("id", user!.id).single(),
    supabase
      .from("calendar_events")
      .select("*")
      .gte("event_date", yearStart)
      .lte("event_date", yearEnd)
      .order("event_date"),
    supabase.from("event_types").select("*").is("archived_at", null).order("sort_order"),
  ]);

  return (
    <YearPlanView
      year={year}
      initialView={view}
      projects={projects || []}
      phases={phases || []}
      roomGroups={roomGroups || []}
      phasePlans={(phasePlans || []) as PhasePlan[]}
      showRoomGroups={userPrefs?.show_room_groups ?? true}
      calendarEvents={(calendarEvents || []) as CalendarEvent[]}
      eventTypes={(eventTypes || []) as EventType[]}
    />
  );
}
