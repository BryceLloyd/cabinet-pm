import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";
import { ProjectEventsSection } from "@/components/projects/project-events-section";
import type { CalendarEvent, EventType } from "@/lib/types";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: project },
    { data: rooms },
    { data: tasks },
    { data: phases },
    { data: profiles },
    { data: roomGroups },
    { data: calendarEvents },
    { data: eventTypes },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase.from("rooms").select("*").eq("project_id", id).order("sort_order"),
    supabase
      .from("tasks")
      .select("*")
      .eq("project_id", id)
      .order("completed_at", { ascending: true, nullsFirst: true })
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("phases").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("room_groups").select("*").eq("project_id", id).order("sort_order"),
    supabase
      .from("calendar_events")
      .select("*")
      .eq("project_id", id)
      .order("event_date"),
    supabase.from("event_types").select("*").is("archived_at", null).order("sort_order"),
  ]);

  if (!project) notFound();

  return (
    <div className="container py-6 md:py-8 px-4">
      <div className="mb-6">
        <Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground">← All projects</Link>
      </div>

      <ProjectDetailClient
        project={project}
        initialRooms={rooms || []}
        initialTasks={tasks || []}
        phases={phases || []}
        profiles={profiles || []}
        initialRoomGroups={roomGroups || []}
      />

      <div className="mt-6">
        <ProjectEventsSection
          projectId={project.id}
          initialEvents={(calendarEvents || []) as CalendarEvent[]}
          eventTypes={(eventTypes || []) as EventType[]}
          roomGroups={roomGroups || []}
        />
      </div>
    </div>
  );
}
