import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const [{ data: projects }, { data: phases }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, client_name, estimated_completion_date, start_date, current_phase_id, status, lead_time_weeks")
      .order("estimated_completion_date"),
    supabase.from("phases").select("id, name, color").is("archived_at", null).order("sort_order"),
  ]);

  const phaseMap = new Map((phases || []).map((p) => [p.id, p]));

  return (
    <div className="container py-6 md:py-8 px-4">
      <div className="flex justify-end mb-6">
        <Link href="/projects/new" className="h-9 px-4 inline-flex items-center rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">New project</Link>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Name</th>
              <th className="text-left font-medium px-4 py-2.5">Client</th>
              <th className="text-left font-medium px-4 py-2.5">Phase</th>
              <th className="text-left font-medium px-4 py-2.5">Start</th>
              <th className="text-left font-medium px-4 py-2.5">Completion</th>
              <th className="text-left font-medium px-4 py-2.5">Lead</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(projects || []).length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No projects yet.</td></tr>
            )}
            {(projects || []).map((p: any) => {
              const phase = p.current_phase_id ? phaseMap.get(p.current_phase_id) : null;
              return (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.client_name || "—"}</td>
                  <td className="px-4 py-3">
                    {phase ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${phase.color}20`, color: phase.color }}>
                        {phase.name}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{format(new Date(p.start_date), "MMM d, yyyy")}</td>
                  <td className="px-4 py-3 tabular-nums">{format(new Date(p.estimated_completion_date), "MMM d, yyyy")}</td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{p.lead_time_weeks}w</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground capitalize">{p.status.replace("_", " ")}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {(projects || []).length === 0 && (
          <div className="rounded-lg border bg-card px-4 py-12 text-center text-sm text-muted-foreground">No projects yet.</div>
        )}
        {(projects || []).map((p: any) => {
          const phase = p.current_phase_id ? phaseMap.get(p.current_phase_id) : null;
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className="block rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-medium text-sm">{p.name}</div>
                {phase && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                    style={{ backgroundColor: `${phase.color}20`, color: phase.color }}>
                    {phase.name}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                {p.client_name && <div>{p.client_name}</div>}
                <div>
                  {format(new Date(p.start_date), "MMM d")} → {format(new Date(p.estimated_completion_date), "MMM d, yyyy")}
                  <span className="ml-2">({p.lead_time_weeks}w)</span>
                </div>
                <div className="capitalize">{p.status.replace("_", " ")}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
