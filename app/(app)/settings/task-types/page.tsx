import { createClient } from "@/lib/supabase/server";
import { TaskTypeManager } from "@/components/settings/task-type-manager";

export default async function TaskTypesSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: taskTypes }, { data: profile }] = await Promise.all([
    supabase.from("task_types").select("*").order("sort_order"),
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
  ]);

  const isAdmin = profile?.role === "admin";

  return <TaskTypeManager initialTaskTypes={taskTypes || []} isAdmin={isAdmin} />;
}
