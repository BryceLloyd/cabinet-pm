import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { loadHardwareBatches } from "@/lib/production/queries";
import { HardwareOrders } from "@/components/production/hardware-orders";

function one<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

export default async function HardwarePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [batches, cutlistsRes, suppliersRes, hardwareRes] = await Promise.all([
    loadHardwareBatches(supabase),
    supabase.from("cutlists").select("id, name, project:projects(name)").order("created_at", { ascending: false }),
    supabase.from("suppliers").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("hardware_catalog").select("*").is("archived_at", null).order("sort_order"),
  ]);

  const cutlists = (cutlistsRes.data ?? []).map((c) => {
    const project = one<{ name: string }>(c.project);
    return { id: c.id, label: `${project?.name ?? ""} · ${c.name}` };
  });
  const openCount = batches.filter((b) => b.status !== "received").length;

  return (
    <div className="container py-6 md:py-8 px-4">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold">Hardware orders</h1>
        <span className="text-sm text-muted-foreground">{openCount} open</span>
      </div>
      <HardwareOrders batches={batches} cutlists={cutlists} suppliers={suppliersRes.data ?? []} hardwareCatalog={hardwareRes.data ?? []} userId={user.id} />
    </div>
  );
}
