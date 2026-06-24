"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import { AddHardwareOrderPanel } from "@/components/production/add-hardware-order-panel";
import type { Supplier, Material, PaintType, HardwareCatalogItem, HardwareItemStatus } from "@/lib/types";

interface MaterialRow {
  id: string;
  material_name: string;
  supplierName: string | null;
  paintName: string | null;
}

interface HwOrderDetail {
  id: string;
  title: string;
  items: { id: string; name: string; qty: number | null; supplierName: string | null; status: HardwareItemStatus }[];
}

interface Props {
  cutlist: { id: string; name: string; projectName: string; label: string };
  projectRooms: { id: string; name: string }[];
  selectedRoomIds: string[];
  materialOrders: MaterialRow[];
  hardwareOrders: HwOrderDetail[];
  suppliers: Supplier[];
  materials: Material[];
  paintTypes: PaintType[];
  hardwareCatalog: HardwareCatalogItem[];
  userId: string;
}

const CUSTOM = "__custom__";

export function CutlistDetail({ cutlist, projectRooms, selectedRoomIds, materialOrders, hardwareOrders, suppliers, materials, paintTypes, hardwareCatalog, userId }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(cutlist.name);
  const [busy, setBusy] = useState(false);
  const [hwOpen, setHwOpen] = useState(false);
  const [mat, setMat] = useState({ choice: "", custom: "", supplier_id: "", paint_type_id: "" });

  const cutEdgeSuppliers = suppliers.filter((s) => s.category === "cut_edge");
  const matDefault = new Map(materials.map((m) => [m.name, m.default_supplier_id]));

  async function regen() {
    await supabase.rpc("generate_production_items", { p_cutlist_id: cutlist.id });
    router.refresh();
  }

  async function saveName() {
    if (!name.trim() || name.trim() === cutlist.name) return;
    await supabase.from("cutlists").update({ name: name.trim() }).eq("id", cutlist.id);
    router.refresh();
  }

  async function toggleRoom(roomId: string) {
    setBusy(true);
    if (selectedRoomIds.includes(roomId)) {
      await supabase.from("cutlist_rooms").delete().eq("cutlist_id", cutlist.id).eq("room_id", roomId);
    } else {
      const max = selectedRoomIds.length;
      await supabase.from("cutlist_rooms").insert({ cutlist_id: cutlist.id, room_id: roomId, sort_order: max });
    }
    await regen();
    setBusy(false);
  }

  async function addMaterial() {
    const matName = (mat.choice === CUSTOM ? mat.custom : mat.choice).trim();
    if (!matName) return;
    setBusy(true);
    if (mat.choice === CUSTOM && !materials.some((m) => m.name.toLowerCase() === matName.toLowerCase())) {
      await supabase.from("materials").insert({ name: matName, sort_order: materials.length });
    }
    await supabase.from("material_orders").insert({
      cutlist_id: cutlist.id,
      material_name: matName,
      supplier_id: mat.supplier_id || null,
      paint_type_id: mat.paint_type_id || null,
      sort_order: materialOrders.length,
    });
    setMat({ choice: "", custom: "", supplier_id: "", paint_type_id: "" });
    await regen();
    setBusy(false);
  }

  async function removeMaterial(id: string) {
    setBusy(true);
    await supabase.from("material_orders").delete().eq("id", id);
    await regen();
    setBusy(false);
  }

  async function deleteCutlist() {
    if (!confirm("Delete this cutlist and everything tracked for it?")) return;
    await supabase.from("cutlists").delete().eq("id", cutlist.id);
    router.push("/production/cutlists");
  }

  const sel = "h-8 px-2 rounded-md border bg-background text-sm";

  return (
    <div className="container py-6 md:py-8 px-4 max-w-2xl space-y-6">
      <div>
        <div className="text-xs text-muted-foreground mb-1">{cutlist.projectName}</div>
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} className="text-lg font-semibold w-full bg-transparent border-b border-transparent hover:border-input focus:border-input outline-none py-1" />
      </div>

      <section className="rounded-lg border bg-card">
        <div className="px-4 py-3 border-b"><h2 className="font-medium text-sm">Rooms</h2></div>
        <div className="px-4 py-3">
          {projectRooms.length === 0 ? (
            <p className="text-xs text-muted-foreground">This project has no rooms.</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {projectRooms.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" disabled={busy} checked={selectedRoomIds.includes(r.id)} onChange={() => toggleRoom(r.id)} className="size-4 rounded border-input" />
                  {r.name}
                </label>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="px-4 py-3 border-b"><h2 className="font-medium text-sm">Cut &amp; edge orders</h2></div>
        <ul className="divide-y">
          {materialOrders.map((m) => (
            <li key={m.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0 text-sm">
                <span className="font-medium">{m.material_name}</span>
                <span className="text-xs text-muted-foreground">{m.supplierName ? ` · ${m.supplierName}` : ""}{m.paintName ? ` · ${m.paintName}` : ""}</span>
              </div>
              <button onClick={() => removeMaterial(m.id)} disabled={busy} className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 size={15} /></button>
            </li>
          ))}
          {materialOrders.length === 0 && <li className="px-4 py-3 text-xs text-muted-foreground">No cut &amp; edge orders yet.</li>}
        </ul>
        <div className="px-4 py-3 border-t flex flex-wrap items-center gap-1.5">
          <select value={mat.choice} onChange={(e) => { const v = e.target.value; const def = matDefault.get(v); setMat((p) => ({ ...p, choice: v, supplier_id: def ?? p.supplier_id })); }} className={`${sel} flex-1 min-w-[120px]`}>
            <option value="">Material…</option>
            {materials.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            <option value={CUSTOM}>+ Custom…</option>
          </select>
          {mat.choice === CUSTOM && (
            <input value={mat.custom} onChange={(e) => setMat((p) => ({ ...p, custom: e.target.value }))} placeholder="Custom" className={`${sel} flex-1 min-w-[100px]`} />
          )}
          <select value={mat.supplier_id} onChange={(e) => setMat((p) => ({ ...p, supplier_id: e.target.value }))} className={`${sel} flex-1 min-w-[110px]`}>
            <option value="">Supplier…</option>
            {cutEdgeSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={mat.paint_type_id} onChange={(e) => setMat((p) => ({ ...p, paint_type_id: e.target.value }))} className={`${sel} flex-1 min-w-[100px]`}>
            <option value="">No paint</option>
            {paintTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
          </select>
          <button onClick={addMaterial} disabled={busy} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1"><Plus size={13} />Add</button>
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-medium text-sm">Hardware orders</h2>
          <button onClick={() => setHwOpen(true)} className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"><Plus size={13} />Add hardware order</button>
        </div>
        <ul className="divide-y">
          {hardwareOrders.map((o) => (
            <li key={o.id} className="px-4 py-2.5 text-sm">
              <span className="font-medium">{o.title}</span>
              {o.items.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {o.items.map((i) => (
                    <li key={i.id} className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{i.name}{i.qty ? ` ×${i.qty}` : ""}</span>
                      {i.supplierName && <span className="text-muted-foreground/70">· {i.supplierName}</span>}
                      <span className="ml-auto">{i.status === "to_order" ? "To order" : i.status === "ordered" ? "Ordered" : "Received"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {hardwareOrders.length === 0 && <li className="px-4 py-3 text-xs text-muted-foreground">No hardware orders yet.</li>}
        </ul>
      </section>

      <div>
        <button onClick={deleteCutlist} className="text-xs text-destructive hover:underline">Delete cutlist</button>
      </div>

      <AddHardwareOrderPanel open={hwOpen} onClose={() => setHwOpen(false)} cutlists={[]} suppliers={suppliers} hardwareCatalog={hardwareCatalog} userId={userId} fixedCutlistId={cutlist.id} fixedCutlistLabel={cutlist.label} />
    </div>
  );
}
