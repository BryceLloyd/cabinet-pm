"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SlidePanel } from "@/components/ui/slide-panel";
import { Plus, Trash2 } from "lucide-react";
import type { HardwareCatalogItem, Supplier } from "@/lib/types";

interface CutlistOpt { id: string; label: string }

interface Props {
  open: boolean;
  onClose: () => void;
  cutlists: CutlistOpt[];
  suppliers: Supplier[];
  hardwareCatalog: HardwareCatalogItem[];
  userId: string;
  /** Lock the order to a cutlist (when opened from a cutlist page). */
  fixedCutlistId?: string;
  fixedCutlistLabel?: string;
}

const CUSTOM = "__custom__";
let seq = 0;
const k = () => `h${++seq}`;
interface Line { key: string; choice: string; custom: string; qty: string; supplier_id: string }
const newLine = (): Line => ({ key: k(), choice: "", custom: "", qty: "", supplier_id: "" });

export function AddHardwareOrderPanel({ open, onClose, cutlists, suppliers, hardwareCatalog, userId, fixedCutlistId, fixedCutlistLabel }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const hardwareSuppliers = suppliers.filter((s) => s.category === "hardware");
  const hwDefault = new Map(hardwareCatalog.map((h) => [h.name, h.default_supplier_id]));

  const [title, setTitle] = useState("");
  const [cutlistId, setCutlistId] = useState(fixedCutlistId ?? "");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setCutlistId(fixedCutlistId ?? "");
      setLines([newLine()]);
      setError(null);
    }
  }, [open, fixedCutlistId]);

  async function handleSubmit() {
    setError(null);
    if (!title.trim()) return setError("Give the order a title.");
    setSaving(true);
    try {
      const { data: order, error: oErr } = await supabase
        .from("hardware_orders")
        .insert({ title: title.trim(), cutlist_id: cutlistId || null, created_by: userId })
        .select("id").single();
      if (oErr || !order) throw oErr ?? new Error("Could not create order");

      const resolved = lines
        .map((l) => ({ name: (l.choice === CUSTOM ? l.custom : l.choice).trim(), qty: l.qty ? parseInt(l.qty, 10) : null, supplier_id: l.supplier_id || null }))
        .filter((l) => l.name);

      const known = new Set(hardwareCatalog.map((h) => h.name.toLowerCase()));
      const custom = [...new Set(lines.filter((l) => l.choice === CUSTOM && l.custom.trim()).map((l) => l.custom.trim()))]
        .filter((n) => !known.has(n.toLowerCase()));
      if (custom.length) {
        await supabase.from("hardware_catalog").insert(custom.map((nm, i) => ({ name: nm, sort_order: hardwareCatalog.length + i })));
      }

      if (resolved.length) {
        const { error } = await supabase.from("hardware_order_items")
          .insert(resolved.map((l, i) => ({ hardware_order_id: order.id, name: l.name, qty: l.qty, supplier_id: l.supplier_id, sort_order: i })));
        if (error) throw error;
      }

      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SlidePanel open={open} onClose={onClose} title="New hardware order">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Hinges & runners" className="w-full h-9 px-3 rounded-md border bg-background text-sm" />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cutlist {fixedCutlistId && <span className="text-muted-foreground/70">(linked)</span>}</label>
          {fixedCutlistId ? (
            <div className="h-9 px-3 rounded-md border bg-muted/40 text-sm flex items-center text-muted-foreground">{fixedCutlistLabel}</div>
          ) : (
            <select value={cutlistId} onChange={(e) => setCutlistId(e.target.value)} className="w-full h-9 px-3 rounded-md border bg-background text-sm">
              <option value="">Standalone (no cutlist)</option>
              {cutlists.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Items</label>
          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.key} className="space-y-1.5 rounded-md border p-2">
                <div className="flex items-center gap-1.5">
                  <select value={l.choice} onChange={(e) => { const v = e.target.value; const def = hwDefault.get(v); setLines((p) => p.map((x) => x.key === l.key ? { ...x, choice: v, supplier_id: def ?? x.supplier_id } : x)); }} className="flex-1 min-w-0 h-8 px-2 rounded-md border bg-background text-sm">
                    <option value="">Hardware…</option>
                    {hardwareCatalog.map((h) => <option key={h.id} value={h.name}>{h.name}</option>)}
                    <option value={CUSTOM}>+ Custom…</option>
                  </select>
                  <input value={l.qty} onChange={(e) => setLines((p) => p.map((x) => x.key === l.key ? { ...x, qty: e.target.value } : x))} placeholder="Qty" inputMode="numeric" className="w-16 shrink-0 h-8 px-2 rounded-md border bg-background text-sm" />
                  <button type="button" title="Remove" onClick={() => setLines((p) => p.length > 1 ? p.filter((x) => x.key !== l.key) : p)} className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 size={15} /></button>
                </div>
                {l.choice === CUSTOM && (
                  <input value={l.custom} onChange={(e) => setLines((p) => p.map((x) => x.key === l.key ? { ...x, custom: e.target.value } : x))} placeholder="Custom hardware name" className="w-full h-8 px-2 rounded-md border bg-background text-sm" />
                )}
                <select value={l.supplier_id} onChange={(e) => setLines((p) => p.map((x) => x.key === l.key ? { ...x, supplier_id: e.target.value } : x))} className="w-full h-8 px-2 rounded-md border bg-background text-sm">
                  <option value="">Supplier…</option>
                  {hardwareSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setLines((p) => [...p, newLine()])} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"><Plus size={14} />Add item</button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-md border text-sm hover:bg-muted">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={saving} className="flex-[2] h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? "Creating…" : "Create order"}</button>
        </div>
      </div>
    </SlidePanel>
  );
}
