import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: rooms }, { data: tasks }, { data: phases }, { data: profiles }] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", id).maybeSingle(),
      supabase.from("rooms").select("*").eq("project_id", id).order("sort_order"),
      supabase
        .from("tasks")
        .select("*")
        .eq("project_id", id)
        .order("completed_at", { ascending: true, nullsFirst: true })
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("phases").select("*").order("sort_order"),
      supabase.from("profiles").select("id, full_name"),
    ]);

  if (!project) notFound();

  return (
    <div className="container py-8">
      <div className="mb-6">
        <Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground">← All projects</Link>
        <div className="mt-1 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {project.client_name && <span>{project.client_name}</span>}
              {project.site_address && <span> · {project.site_address}</span>}
            </div>
          </div>
          <div className="text-right text-sm tabular-nums">
            <div className="text-muted-foreground text-xs">Completion</div>
            <div className="font-medium">{format(new Date(project.estimated_completion_date), "MMM d, yyyy")}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Starts {format(new Date(project.start_date), "MMM d")} · {project.lead_time_weeks}w lead
            </div>
          </div>
        </div>
      </div>

      <ProjectDetailClient
        project={project}
        initialRooms={rooms || []}
        initialTasks={tasks || []}
        phases={phases || []}
        profiles={profiles || []}
      />
    </div>
  );
}
