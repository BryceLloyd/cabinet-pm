import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { format, isPast, isToday } from "date-fns";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: myTasks }, { data: activeProjects }, { data: phases }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_date, project_id, room_id, priority, projects(name), rooms(name)")
      .eq("assigned_to", user!.id)
      .is("completed_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from("projects")
      .select("id, name, client_name, estimated_completion_date, start_date, current_phase_id, status")
      .in("status", ["planning", "active"])
      .order("estimated_completion_date", { ascending: true })
      .limit(10),
    supabase.from("phases").select("id, name, color").order("sort_order"),
  ]);

  const phaseMap = new Map((phases || []).map((p) => [p.id, p]));

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Dashboard</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-lg border bg-card">
          <div className="px-5 py-3.5 border-b flex items-center justify-between">
            <h2 className="font-medium">My tasks</h2>
            <Link href="/tasks" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
          </div>
          <ul className="divide-y">
            {(myTasks || []).length === 0 && (
              <li className="px-5 py-8 text-sm text-muted-foreground text-center">No open tasks. Nice.</li>
            )}
            {(myTasks || []).map((t: any) => {
              const overdue = t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
              return (
                <li key={t.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t.projects?.name && <span>{t.projects.name}</span>}
                      {t.rooms?.name && <span> · {t.rooms.name}</span>}
                      {!t.projects && !t.rooms && <span>Personal</span>}
                    </div>
                  </div>
                  {t.due_date && (
                    <div className={`text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                      {format(new Date(t.due_date), "MMM d")}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-lg border bg-card">
          <div className="px-5 py-3.5 border-b flex items-center justify-between">
            <h2 className="font-medium">Active projects</h2>
            <Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
          </div>
          <ul className="divide-y">
            {(activeProjects || []).length === 0 && (
              <li className="px-5 py-8 text-sm text-muted-foreground text-center">No active projects yet.</li>
            )}
            {(activeProjects || []).map((p: any) => {
              const phase = phaseMap.get(p.current_phase_id);
              return (
                <li key={p.id} className="px-5 py-3">
                  <Link href={`/projects/${p.id}`} className="block hover:opacity-70 transition-opacity">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {p.client_name && <>{p.client_name} · </>}
                          Due {format(new Date(p.estimated_completion_date), "MMM d, yyyy")}
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
        </section>
      </div>
    </div>
  );
}
