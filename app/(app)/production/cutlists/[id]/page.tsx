import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { CutlistDetail } from "@/components/production/cutlist-detail";

function one<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

export default async function CutlistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cutlist } = await supabase
    .from("cutlists")
    .select("id, name, project_id, project:projects(name)")
    .eq("id", id)
    .maybeSingle();
  if (!cutlist) notFound();

  const project = one<{ name: string }>(cutlist.project);

  const [roomsRes, selRoomsRes, matRes, hwRes, suppliersRes, materialsRes, paintsRes, hardwareRes] = await Promise.all([
    supabase.from("rooms").select("id, name").eq("project_id", cutlist.project_id).order("sort_order"),
    supabase.from("cutlist_rooms").select("room_id").eq("cutlist_id", id),
    supabase.from("material_orders").select("id, material_name, supplier_id, paint_type_id, sort_order").eq("cutlist_id", id).order("sort_order"),
    supabase.from("hardware_orders").select("id, title, items:hardware_order_items(id, name, qty, supplier_id, status, sort_order)").eq("cutlist_id", id).order("created_at"),
    supabase.from("suppliers").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("materials").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("paint_types").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("hardware_catalog").select("*").is("archived_at", null).order("sort_order"),
  ]);

  const supName = new Map((suppliersRes.data ?? []).map((s) => [s.id, s.name]));
  const paintName = new Map((paintsRes.data ?? []).map((p) => [p.id, p.name]));

  const materialOrders = (matRes.data ?? []).map((m) => ({
    id: m.id,
    material_name: m.material_name,
    supplierName: m.supplier_id ? supName.get(m.supplier_id) ?? null : null,
    paintName: m.paint_type_id ? paintName.get(m.paint_type_id) ?? null : null,
  }));

  const hardwareOrders = (hwRes.data ?? []).map((o) => ({
    id: o.id,
    title: o.title,
    items: (o.items ?? [])
      .slice()
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      .map((i: { id: string; name: string; qty: number | null; supplier_id: string | null; status: import("@/lib/types").HardwareItemStatus }) => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        supplierName: i.supplier_id ? supName.get(i.supplier_id) ?? null : null,
        status: i.status,
      })),
  }));

  const label = `${project?.name ?? ""} · ${cutlist.name}`;

  return (
    <CutlistDetail
      cutlist={{ id: cutlist.id, name: cutlist.name, projectName: project?.name ?? "", label }}
      projectRooms={roomsRes.data ?? []}
      selectedRoomIds={(selRoomsRes.data ?? []).map((r) => r.room_id)}
      materialOrders={materialOrders}
      hardwareOrders={hardwareOrders}
      suppliers={suppliersRes.data ?? []}
      materials={materialsRes.data ?? []}
      paintTypes={paintsRes.data ?? []}
      hardwareCatalog={hardwareRes.data ?? []}
      userId={user.id}
    />
  );
}
