import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";

type Filter = "mine" | "all" | "personal" | "completed";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter = (params.filter as Filter) || "mine";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from("tasks")
    .select("*, projects(name), rooms(name), assignee:assigned_to(full_name), completer:completed_by(full_name)")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filter === "mine") query = query.eq("assigned_to", user!.id).is("completed_at", null);
  else if (filter === "personal") query = query.is("project_id", null).is("room_id", null).eq("created_by", user!.id);
  else if (filter === "completed") query = query.not("completed_at", "is", null);
  else if (filter === "all") query = query.is("completed_at", null);

  const { data: tasks } = await query;

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "mine", label: "My tasks" },
    { key: "all", label: "All open" },
    { key: "personal", label: "Personal" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div className="container py-6 md:py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Tasks</h1>
        <div className="flex items-center rounded-md border p-0.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/tasks?filter=${f.key}`}
              className={`h-7 px-3 text-xs rounded grid place-items-center whitespace-nowrap ${
                filter === f.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >{f.label}</Link>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Task</th>
              <th className="text-left font-medium px-4 py-2.5">Project / Room</th>
              <th className="text-left font-medium px-4 py-2.5">Assignee</th>
              <th className="text-left font-medium px-4 py-2.5">Due</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(tasks || []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No tasks.</td></tr>
            )}
            {(tasks || []).map((t: any) => (
              <tr key={t.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className={t.completed_at ? "line-through text-muted-foreground" : "font-medium"}>{t.title}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {t.projects ? (
                    <Link href={`/projects/${t.project_id}`} className="hover:underline">{t.projects.name}</Link>
                  ) : <span>Personal</span>}
                  {t.rooms && <span> · {t.rooms.name}</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{t.assignee?.full_name || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">
                  {t.due_date ? format(new Date(t.due_date), "MMM d, yyyy") : "—"}
                </td>
                <td className="px-4 py-3">
                  {t.completed_at ? (
                    <span className="text-xs text-muted-foreground">
                      ✓ {t.completer?.full_name || "done"}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Open</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {(tasks || []).length === 0 && (
          <div className="rounded-lg border bg-card px-4 py-12 text-center text-sm text-muted-foreground">No tasks.</div>
        )}
        {(tasks || []).map((t: any) => (
          <div key={t.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className={`text-sm ${t.completed_at ? "line-through text-muted-foreground" : "font-medium"}`}>
                {t.title}
              </div>
              {t.completed_at ? (
                <span className="text-xs text-muted-foreground shrink-0">✓</span>
              ) : (
                <span className="text-xs text-muted-foreground shrink-0">Open</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>
                {t.projects ? (
                  <Link href={`/projects/${t.project_id}`} className="hover:underline">{t.projects.name}</Link>
                ) : "Personal"}
                {t.rooms && <span> · {t.rooms.name}</span>}
              </div>
              <div className="flex gap-3">
                {t.assignee?.full_name && <span>{t.assignee.full_name}</span>}
                {t.due_date && <span className="tabular-nums">{format(new Date(t.due_date), "MMM d")}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
