"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Archive, RotateCcw, Plus, ChevronDown, ChevronRight } from "lucide-react";

interface ListItem {
  id: string;
  name: string;
  sort_order: number;
  archived_at: string | null;
  default_supplier_id?: string | null;
}

interface Props {
  title: string;
  subtitle?: string;
  /** Supabase table name, e.g. "materials". */
  table: string;
  initialItems: ListItem[];
  isAdmin: boolean;
  /** When provided, each row gets a default-supplier dropdown (writes default_supplier_id). */
  supplierOptions?: { id: string; name: string }[];
}

/** Generic name-list CRUD (materials, paint types, hardware catalog), with an optional default-supplier column. */
export function SimpleListManager({ title, subtitle, table, initialItems, isAdmin, supplierOptions }: Props) {
  const supabase = createClient();
  const [items, setItems] = useState<ListItem[]>(initialItems.filter((i) => !i.archived_at));
  const [archived, setArchived] = useState<ListItem[]>(initialItems.filter((i) => !!i.archived_at));
  const [showArchived, setShowArchived] = useState(false);

  function setName(id: string, name: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, name } : i)));
  }
  async function setSupplier(id: string, supplierId: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, default_supplier_id: supplierId || null } : i)));
    await supabase.from(table).update({ default_supplier_id: supplierId || null }).eq("id", id);
  }
  async function saveName(id: string) {
    const it = items.find((x) => x.id === id);
    if (!it || !it.name.trim()) return;
    await supabase.from(table).update({ name: it.name.trim() }).eq("id", id);
  }
  async function add() {
    const maxOrder = items.reduce((m, i) => Math.max(m, i.sort_order), -1);
    const { data, error } = await supabase.from(table).insert({ name: `New ${title.toLowerCase().replace(/s$/, "")}`, sort_order: maxOrder + 1 }).select("*").single();
    if (!error && data) setItems((prev) => [...prev, data as ListItem]);
  }
  async function archiveItem(id: string) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const at = new Date().toISOString();
    const { error } = await supabase.from(table).update({ archived_at: at }).eq("id", id);
    if (!error) {
      setItems((prev) => prev.filter((x) => x.id !== id));
      setArchived((prev) => [...prev, { ...it, archived_at: at }]);
    }
  }
  async function restore(id: string) {
    const it = archived.find((x) => x.id === id);
    if (!it) return;
    const maxOrder = items.reduce((m, x) => Math.max(m, x.sort_order), -1);
    const { error } = await supabase.from(table).update({ archived_at: null, sort_order: maxOrder + 1 }).eq("id", id);
    if (!error) {
      setArchived((prev) => prev.filter((x) => x.id !== id));
      setItems((prev) => [...prev, { ...it, archived_at: null, sort_order: maxOrder + 1 }]);
    }
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3.5 border-b flex items-center justify-between">
        <h2 className="font-medium">{title}</h2>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>

      {items.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted-foreground">None yet.</div>}

      <ul className="divide-y">
        {items.map((it) => (
          <li key={it.id} className="px-5 py-2.5 flex items-center gap-2">
            <input
              value={it.name}
              disabled={!isAdmin}
              onChange={(e) => setName(it.id, e.target.value)}
              onBlur={() => saveName(it.id)}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              className="flex-1 h-8 px-2 text-sm rounded-md border bg-background min-w-0 disabled:opacity-60"
            />
            {supplierOptions && (
              <select
                value={it.default_supplier_id ?? ""}
                disabled={!isAdmin}
                onChange={(e) => setSupplier(it.id, e.target.value)}
                title="Default supplier"
                className="shrink-0 h-8 px-2 text-xs rounded-md border bg-background max-w-[140px] disabled:opacity-60"
              >
                <option value="">No default supplier</option>
                {supplierOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {isAdmin && (
              <button onClick={() => archiveItem(it.id)} className="shrink-0 text-muted-foreground hover:text-foreground" title="Archive"><Archive size={16} /></button>
            )}
          </li>
        ))}
      </ul>

      {isAdmin && (
        <div className="px-5 py-3 border-t">
          <button onClick={add} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"><Plus size={14} />Add</button>
        </div>
      )}

      {isAdmin && archived.length > 0 && (
        <div className="border-t">
          <button onClick={() => setShowArchived(!showArchived)} className="w-full px-5 py-3 flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}Archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="divide-y border-t">
              {archived.map((it) => (
                <li key={it.id} className="px-5 py-3 flex items-center justify-between opacity-60">
                  <span className="text-sm">{it.name}</span>
                  <button onClick={() => restore(it.id)} className="flex items-center gap-1 text-xs text-primary hover:underline"><RotateCcw size={12} />Restore</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
