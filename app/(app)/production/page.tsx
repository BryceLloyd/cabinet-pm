import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { loadDashboard } from "@/lib/production/queries";
import { ProductionDashboard } from "@/components/production/production-dashboard";

export default async function ProductionDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [dashboard, projectsRes, suppliersRes, materialsRes, paintsRes, hardwareRes] = await Promise.all([
    loadDashboard(supabase),
    supabase.from("projects").select("id, name").order("name"),
    supabase.from("suppliers").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("materials").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("paint_types").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("hardware_catalog").select("*").is("archived_at", null).order("sort_order"),
  ]);

  return (
    <ProductionDashboard
      data={dashboard}
      projects={projectsRes.data ?? []}
      suppliers={suppliersRes.data ?? []}
      materials={materialsRes.data ?? []}
      paintTypes={paintsRes.data ?? []}
      hardwareCatalog={hardwareRes.data ?? []}
      userId={user.id}
    />
  );
}
