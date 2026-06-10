import { createClient } from "@/lib/supabase/server";
import { TasksClient } from "@/components/tasks/tasks-client";

type Filter = "mine" | "all" | "personal" | "completed";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter = (["mine", "all", "personal", "completed"].includes(params.filter || "")
    ? params.filter
    : "mine") as Filter;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from("tasks")
    .select("*, projects(name), rooms(name), room_groups(name), task_types(id,name,color), assignee:assigned_to(full_name), completer:completed_by(full_name), task_checklist_items(id, completed_at)");

  if (filter === "mine") {
    query = query.eq("assigned_to", user!.id).is("completed_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
  } else if (filter === "personal") {
    query = query.is("project_id", null).is("room_id", null).eq("created_by", user!.id).is("completed_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
  } else if (filter === "completed") {
    query = query.not("completed_at", "is", null)
      .order("completed_at", { ascending: false });
  } else if (filter === "all") {
    query = query.is("completed_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
  }

  const [{ data: tasks }, { data: projects }, { data: profiles }, { data: taskTypes }, { data: templates }] = await Promise.all([
    query,
    supabase
      .from("projects")
      .select("id, name")
      .in("status", ["planning", "active"])
      .order("name"),
    supabase.from("profiles").select("id, full_name").is("deactivated_at", null),
    supabase.from("task_types").select("id, name, color").is("archived_at", null).order("sort_order"),
    supabase.from("task_templates").select("id, name, items").order("sort_order"),
  ]);

  return (
    <TasksClient
      key={filter}
      initialTasks={tasks || []}
      projects={projects || []}
      profiles={profiles || []}
      taskTypes={taskTypes || []}
      templates={templates || []}
      userId={user!.id}
      filter={filter}
    />
  );
}
