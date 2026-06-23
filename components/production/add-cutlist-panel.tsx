"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SlidePanel } from "@/components/ui/slide-panel";
import { Plus, Trash2 } from "lucide-react";
import type { Supplier, Material, PaintType, HardwareCatalogItem } from "@/lib/types";

interface ProjectOpt { id: string; name: string }
interface RoomOpt { id: string; name: string }

interface Props {
  open: boolean;
  onClose: () => void;
  projects: ProjectOpt[];
  suppliers: Supplier[];
  materials: Material[];
  paintTypes: PaintType[];
  hardwareCatalog: HardwareCatalogItem[];
  userId: string;
  defaultProjectId?: string;
}

const CUSTOM = "__custom__";

interface CutEdgeLine {
  key: string;
  materialChoice: string; // material name or CUSTOM
  customMaterial: string;
  supplier_id: string;
  paint_type_id: string;
}
interface HardwareLine {
  key: string;
  choice: string; // catalog name or CUSTOM
  custom: string;
  qty: string;
  supplier_id: string;
}

let seq = 0;
const k = () => `r${++seq}`;
const newCut = (): CutEdgeLine => ({ key: k(), materialChoice: "", customMaterial: "", supplier_id: "", paint_type_id: "" });
const newHw = (): HardwareLine => ({ key: k(), choice: "", custom: "", qty: "", supplier_id: "" });

export function AddCutlistPanel({ open, onClose, projects, suppliers, materials, paintTypes, hardwareCatalog, userId, defaultProjectId }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const cutEdgeSuppliers = suppliers.filter((s) => s.category === "cut_edge");
  const hardwareSuppliers = suppliers.filter((s) => s.category === "hardware");
  const matDefault = new Map(materials.map((m) => [m.name, m.default_supplier_id]));
  const hwDefault = new Map(hardwareCatalog.map((h) => [h.name, h.default_supplier_id]));

  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [rooms, setRooms] = useState<RoomOpt[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [cutLines, setCutLines] = useState<CutEdgeLine[]>([newCut()]);
  const [hwLines, setHwLines] = useState<HardwareLine[]>([newHw()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setProjectId(defaultProjectId ?? "");
      setName("");
      setNameEdited(false);
      setSelectedRooms([]);
      setCutLines([newCut()]);
      setHwLines([newHw()]);
      setError(null);
    }
  }, [open, defaultProjectId]);

  useEffect(() => {
    if (!projectId) { setRooms([]); setSelectedRooms([]); return; }
    let active = true;
    supabase.from("rooms").select("id, name").eq("project_id", projectId).order("sort_order")
      .then(({ data }) => { if (active) setRooms(data ?? []); });
    return () => { active = false; };
  }, [projectId, supabase]);

  // Auto-name from selected rooms (until the user edits the name).
  useEffect(() => {
    if (nameEdited) return;
    const names = rooms.filter((r) => selectedRooms.includes(r.id)).map((r) => r.name);
    setName(names.join(" + "));
  }, [selectedRooms, rooms, nameEdited]);

  function toggleRoom(id: string) {
    setSelectedRooms((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const resolvedCut = cutLines
    .map((l) => ({ ...l, name: (l.materialChoice === CUSTOM ? l.customMaterial : l.materialChoice).trim() }))
    .filter((l) => l.name);
  const paintingCount = resolvedCut.filter((l) => l.paint_type_id).length;
  const preview = `${resolvedCut.length} cut & edge · ${paintingCount} painting · 1 assembly · ${selectedRooms.length} install · 1 hardware`;

  async function handleSubmit() {
    setError(null);
    if (!projectId) return setError("Pick a project.");
    if (!name.trim()) return setError("Give the cutlist a name.");
    setSaving(true);
    try {
      const { data: cutlist, error: cErr } = await supabase
        .from("cutlists")
        .insert({ project_id: projectId, name: name.trim(), created_by: userId })
        .select("id").single();
      if (cErr || !cutlist) throw cErr ?? new Error("Could not create cutlist");

      if (selectedRooms.length) {
        const { error } = await supabase.from("cutlist_rooms")
          .insert(selectedRooms.map((room_id, i) => ({ cutlist_id: cutlist.id, room_id, sort_order: i })));
        if (error) throw error;
      }

      // Auto-save custom materials to the catalog for reuse.
      const knownMaterials = new Set(materials.map((m) => m.name.toLowerCase()));
      const customMats = [...new Set(
        cutLines.filter((l) => l.materialChoice === CUSTOM && l.customMaterial.trim())
          .map((l) => l.customMaterial.trim())
      )].filter((n) => !knownMaterials.has(n.toLowerCase()));
      if (customMats.length) {
        await supabase.from("materials").insert(customMats.map((nm, i) => ({ name: nm, sort_order: materials.length + i })));
      }

      if (resolvedCut.length) {
        const { error } = await supabase.from("material_orders").insert(
          resolvedCut.map((l, i) => ({
            cutlist_id: cutlist.id,
            material_name: l.name,
            supplier_id: l.supplier_id || null,
            paint_type_id: l.paint_type_id || null,
            sort_order: i,
          }))
        );
        if (error) throw error;
      }

      const resolvedHw = hwLines
        .map((l) => ({ name: (l.choice === CUSTOM ? l.custom : l.choice).trim(), qty: l.qty ? parseInt(l.qty, 10) : null, supplier_id: l.supplier_id || null }))
        .filter((l) => l.name);

      const knownHw = new Set(hardwareCatalog.map((h) => h.name.toLowerCase()));
      const customHw = [...new Set(
        hwLines.filter((l) => l.choice === CUSTOM && l.custom.trim()).map((l) => l.custom.trim())
      )].filter((n) => !knownHw.has(n.toLowerCase()));
      if (customHw.length) {
        await supabase.from("hardware_catalog").insert(customHw.map((nm, i) => ({ name: nm, sort_order: hardwareCatalog.length + i })));
      }

      if (resolvedHw.length) {
        const { data: order, error: oErr } = await supabase.from("hardware_orders")
          .insert({ cutlist_id: cutlist.id, title: `${name.trim()} hardware`, created_by: userId })
          .select("id").single();
        if (oErr || !order) throw oErr ?? new Error("Could not create hardware order");
        const { error } = await supabase.from("hardware_order_items")
          .insert(resolvedHw.map((l, i) => ({ hardware_order_id: order.id, name: l.name, qty: l.qty, supplier_id: l.supplier_id, sort_order: i })));
        if (error) throw error;
      }

      const { error: gErr } = await supabase.rpc("generate_production_items", { p_cutlist_id: cutlist.id });
      if (gErr) throw gErr;

      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full h-9 px-3 rounded-md border bg-background text-sm";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-1.5";

  return (
    <SlidePanel open={open} onClose={onClose} title="New cutlist">
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Project</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
            <option value="">Select a project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Rooms {projectId && <span className="text-muted-foreground/70">(auto-names the cutlist)</span>}</label>
          {!projectId ? (
            <p className="text-xs text-muted-foreground">Pick a project to choose rooms.</p>
          ) : rooms.length === 0 ? (
            <p className="text-xs text-muted-foreground">This project has no rooms yet.</p>
          ) : (
            <div className="rounded-md border divide-y">
              {rooms.map((r) => (
                <label key={r.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={selectedRooms.includes(r.id)} onChange={() => toggleRoom(r.id)} className="size-4 rounded border-input" />
                  {r.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>Cutlist name</label>
          <input value={name} onChange={(e) => { setName(e.target.value); setNameEdited(true); }} placeholder="e.g. Kitchen + Scullery" className={inputCls} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-muted-foreground">Cut + Edge Order</label>
            <span className="text-[11px] text-muted-foreground/70">material · supplier · paint</span>
          </div>
          <div className="space-y-2.5">
            {cutLines.map((l) => (
              <div key={l.key} className="rounded-md border p-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <select value={l.materialChoice} onChange={(e) => { const v = e.target.value; const def = matDefault.get(v); setCutLines((p) => p.map((x) => x.key === l.key ? { ...x, materialChoice: v, supplier_id: def ?? x.supplier_id } : x)); }} className="flex-1 min-w-0 h-8 px-2 rounded-md border bg-background text-sm">
                    <option value="">Material…</option>
                    {materials.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                    <option value={CUSTOM}>+ Custom…</option>
                  </select>
                  <button type="button" title="Remove" onClick={() => setCutLines((p) => p.length > 1 ? p.filter((x) => x.key !== l.key) : p)} className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 size={15} /></button>
                </div>
                {l.materialChoice === CUSTOM && (
                  <input value={l.customMaterial} onChange={(e) => setCutLines((p) => p.map((x) => x.key === l.key ? { ...x, customMaterial: e.target.value } : x))} placeholder="Custom material name" className="w-full h-8 px-2 rounded-md border bg-background text-sm" />
                )}
                <div className="flex items-center gap-1.5">
                  <select value={l.supplier_id} onChange={(e) => setCutLines((p) => p.map((x) => x.key === l.key ? { ...x, supplier_id: e.target.value } : x))} className="flex-1 min-w-0 h-8 px-2 rounded-md border bg-background text-sm">
                    <option value="">Supplier…</option>
                    {cutEdgeSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.kind === "in_house" ? "in-house" : "outsource"})</option>)}
                  </select>
                  <select value={l.paint_type_id} onChange={(e) => setCutLines((p) => p.map((x) => x.key === l.key ? { ...x, paint_type_id: e.target.value } : x))} className="flex-1 min-w-0 h-8 px-2 rounded-md border bg-background text-sm">
                    <option value="">No paint</option>
                    {paintTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setCutLines((p) => [...p, newCut()])} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"><Plus size={14} />Add material</button>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Hardware order</label>
          <div className="space-y-2">
            {hwLines.map((l) => (
              <div key={l.key} className="space-y-1.5 rounded-md border p-2">
                <div className="flex items-center gap-1.5">
                  <select value={l.choice} onChange={(e) => { const v = e.target.value; const def = hwDefault.get(v); setHwLines((p) => p.map((x) => x.key === l.key ? { ...x, choice: v, supplier_id: def ?? x.supplier_id } : x)); }} className="flex-1 min-w-0 h-8 px-2 rounded-md border bg-background text-sm">
                    <option value="">Hardware…</option>
                    {hardwareCatalog.map((h) => <option key={h.id} value={h.name}>{h.name}</option>)}
                    <option value={CUSTOM}>+ Custom…</option>
                  </select>
                  <input value={l.qty} onChange={(e) => setHwLines((p) => p.map((x) => x.key === l.key ? { ...x, qty: e.target.value } : x))} placeholder="Qty" inputMode="numeric" className="w-16 shrink-0 h-8 px-2 rounded-md border bg-background text-sm" />
                  <button type="button" title="Remove" onClick={() => setHwLines((p) => p.length > 1 ? p.filter((x) => x.key !== l.key) : p)} className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 size={15} /></button>
                </div>
                {l.choice === CUSTOM && (
                  <input value={l.custom} onChange={(e) => setHwLines((p) => p.map((x) => x.key === l.key ? { ...x, custom: e.target.value } : x))} placeholder="Custom hardware name" className="w-full h-8 px-2 rounded-md border bg-background text-sm" />
                )}
                <select value={l.supplier_id} onChange={(e) => setHwLines((p) => p.map((x) => x.key === l.key ? { ...x, supplier_id: e.target.value } : x))} className="w-full h-8 px-2 rounded-md border bg-background text-sm">
                  <option value="">Supplier…</option>
                  {hardwareSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setHwLines((p) => [...p, newHw()])} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"><Plus size={14} />Add hardware</button>
        </div>

        <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">On save, fills the queues: {preview}</div>
        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-md border text-sm hover:bg-muted">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={saving} className="flex-[2] h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? "Creating…" : "Create cutlist"}</button>
        </div>
      </div>
    </SlidePanel>
  );
}
