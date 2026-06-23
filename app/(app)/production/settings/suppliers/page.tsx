import { createClient } from "@/lib/supabase/server";
import { SupplierManager } from "@/components/settings/supplier-manager";

export default async function SuppliersSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("suppliers").select("*").order("sort_order");
  const all = data ?? [];
  const cutEdge = all.filter((s) => s.category === "cut_edge");
  const hardware = all.filter((s) => s.category === "hardware");

  return (
    <div className="space-y-6">
      <SupplierManager title="Cut & edge suppliers" subtitle="In-house or outsourced" initialSuppliers={cutEdge} category="cut_edge" showKind isAdmin />
      <SupplierManager title="Hardware suppliers" initialSuppliers={hardware} category="hardware" showKind={false} isAdmin />
    </div>
  );
}
