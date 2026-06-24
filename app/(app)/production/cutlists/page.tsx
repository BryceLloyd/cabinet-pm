import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CutlistsIndex } from "@/components/production/cutlists-index";

function one<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

export default async function CutlistsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [cutlistsRes, projectsRes, suppliersRes, materialsRes, paintsRes, hardwareRes] = await Promise.all([
    supabase
      .from("cutlists")
      .select("id, name, project:projects(name), cutlist_rooms(count), material_orders(count), hardware_orders(count)")
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name").order("name"),
    supabase.from("suppliers").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("materials").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("paint_types").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("hardware_catalog").select("*").is("archived_at", null).order("sort_order"),
  ]);

  const cutlists = (cutlistsRes.data ?? []).map((c) => {
    const project = one<{ name: string }>(c.project);
    const count = (rel: unknown): number => {
      const r = one<{ count: number }>(rel as never);
      return r?.count ?? 0;
    };
    return {
      id: c.id,
      name: c.name,
      projectName: project?.name ?? "",
      roomCount: count(c.cutlist_rooms),
      materialCount: count(c.material_orders),
      hardwareCount: count(c.hardware_orders),
    };
  });

  return (
    <CutlistsIndex
      cutlists={cutlists}
      projects={projectsRes.data ?? []}
      suppliers={suppliersRes.data ?? []}
      materials={materialsRes.data ?? []}
      paintTypes={paintsRes.data ?? []}
      hardwareCatalog={hardwareRes.data ?? []}
      userId={user.id}
    />
  );
}
