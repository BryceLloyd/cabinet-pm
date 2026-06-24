import { createClient } from "@/lib/supabase/server";
import { SimpleListManager } from "@/components/settings/simple-list-manager";

export default async function PaintTypesSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("paint_types").select("*").order("sort_order");
  return <SimpleListManager title="Paint types" subtitle="Painting options" table="paint_types" initialItems={data ?? []} isAdmin />;
}
