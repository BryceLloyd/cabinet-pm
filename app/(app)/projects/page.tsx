import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { AddProjectFab } from "@/components/projects/add-project-fab";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, client_name, estimated_completion_date, status, lead_time_weeks")
    .order("estimated_completion_date");

  function displayStatus(status: string) {
    return status === "cancelled" || status === "complete" ? "Archived" : "Active";
  }

  return (
    <div className="container py-6 md:py-8 px-4">
      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Name</th>
              <th className="text-left font-medium px-4 py-2.5">Client</th>
              <th className="text-left font-medium px-4 py-2.5">Completion</th>
              <th className="text-left font-medium px-4 py-2.5">Lead</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(projects || []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No projects yet.</td></tr>
            )}
            {(projects || []).map((p: any) => {
              const status = displayStatus(p.status);
              return (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.client_name || "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{format(new Date(p.estimated_completion_date), "MMM d, yyyy")}</td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{p.lead_time_weeks}w</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      status === "Active"
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-1.5">
        {(projects || []).length === 0 && (
          <div className="rounded-lg border bg-card px-4 py-12 text-center text-sm text-muted-foreground">No projects yet.</div>
        )}
        {(projects || []).map((p: any) => {
          const status = displayStatus(p.status);
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className="block rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="font-medium text-sm">{p.name}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  status === "Active"
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                {p.client_name && <div>{p.client_name}</div>}
                <div>
                  Completion: {format(new Date(p.estimated_completion_date), "MMM d, yyyy")}
                  <span className="ml-2">({p.lead_time_weeks}w)</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <AddProjectFab />
    </div>
  );
}
