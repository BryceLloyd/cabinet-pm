import { createClient } from "@/lib/supabase/server";
import { YearPlanView } from "@/components/plan/year-plan-view";

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

  const [{ data: projects }, { data: phases }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, client_name, estimated_completion_date, start_date, lead_time_weeks, current_phase_id, status")
      .neq("status", "cancelled")
      // Overlaps with the year if start <= yearEnd AND completion >= yearStart
      .lte("start_date", yearEnd)
      .gte("estimated_completion_date", yearStart)
      .order("estimated_completion_date"),
    supabase.from("phases").select("id, name, color").order("sort_order"),
  ]);

  return (
    <YearPlanView
      year={year}
      initialView={view}
      projects={projects || []}
      phases={phases || []}
    />
  );
}
