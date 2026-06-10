import { createClient } from "@/lib/supabase/server";
import { TaskTemplateManager } from "@/components/settings/task-template-manager";

export default async function TaskTemplatesSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: templates } = await supabase
    .from("task_templates")
    .select("*")
    .order("sort_order");

  return <TaskTemplateManager initialTemplates={templates || []} userId={user!.id} />;
}
