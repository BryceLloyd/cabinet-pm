import { createClient } from "@/lib/supabase/server";
import { SimpleListManager } from "@/components/settings/simple-list-manager";

export default async function MaterialsSettingsPage() {
  const supabase = await createClient();
  const [matRes, supRes] = await Promise.all([
    supabase.from("materials").select("*").order("sort_order"),
    supabase.from("suppliers").select("id, name").eq("category", "cut_edge").is("archived_at", null).order("sort_order"),
  ]);
  return (
    <SimpleListManager
      title="Materials"
      subtitle="Cut & edge order options"
      table="materials"
      initialItems={matRes.data ?? []}
      supplierOptions={supRes.data ?? []}
      isAdmin
    />
  );
}
