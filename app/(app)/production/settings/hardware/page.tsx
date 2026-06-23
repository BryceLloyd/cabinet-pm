import { createClient } from "@/lib/supabase/server";
import { SimpleListManager } from "@/components/settings/simple-list-manager";

export default async function HardwareCatalogSettingsPage() {
  const supabase = await createClient();
  const [hwRes, supRes] = await Promise.all([
    supabase.from("hardware_catalog").select("*").order("sort_order"),
    supabase.from("suppliers").select("id, name").eq("category", "hardware").is("archived_at", null).order("sort_order"),
  ]);
  return (
    <SimpleListManager
      title="Hardware"
      subtitle="Hardware order options"
      table="hardware_catalog"
      initialItems={hwRes.data ?? []}
      supplierOptions={supRes.data ?? []}
      isAdmin
    />
  );
}
