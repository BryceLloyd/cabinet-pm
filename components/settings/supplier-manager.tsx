"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Archive, RotateCcw, Plus, ChevronDown, ChevronRight } from "lucide-react";
import type { Supplier, SupplierKind } from "@/lib/types";

interface Props {
  initialSuppliers: Supplier[];
  isAdmin: boolean;
  title?: string;
  subtitle?: string;
  /** Supplier category these belong to (sets it on new rows). */
  category?: "cut_edge" | "hardware";
  /** Show the in-house / outsource selector (cut & edge only). */
  showKind?: boolean;
}

export function SupplierManager({ initialSuppliers, isAdmin, title = "Suppliers", subtitle, category = "cut_edge", showKind = true }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers.filter((s) => !s.archived_at));
  const [archived, setArchived] = useState<Supplier[]>(initialSuppliers.filter((s) => !!s.archived_at));
  const [showArchived, setShowArchived] = useState(false);

  function setName(id: string, name: string) {
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }

  async function saveName(id: string) {
    const s = suppliers.find((x) => x.id === id);
    if (!s || !s.name.trim()) return;
    await supabase.from("suppliers").update({ name: s.name.trim() }).eq("id", id);
  }

  async function handleAdd() {
    const maxOrder = suppliers.reduce((m, s) => Math.max(m, s.sort_order), -1);
    const { data, error } = await supabase
      .from("suppliers")
      .insert({ name: "New supplier", kind: "outsource", category, sort_order: maxOrder + 1 })
      .select("*")
      .single();
    if (!error && data) setSuppliers((prev) => [...prev, data as Supplier]);
  }

  async function setKind(id: string, kind: SupplierKind) {
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, kind } : s)));
    await supabase.from("suppliers").update({ kind }).eq("id", id);
  }

  async function handleArchive(id: string) {
    const s = suppliers.find((x) => x.id === id);
    if (!s) return;
    const at = new Date().toISOString();
    const { error } = await supabase.from("suppliers").update({ archived_at: at }).eq("id", id);
    if (!error) {
      setSuppliers((prev) => prev.filter((x) => x.id !== id));
      setArchived((prev) => [...prev, { ...s, archived_at: at }]);
    }
  }

  async function handleRestore(id: string) {
    const s = archived.find((x) => x.id === id);
    if (!s) return;
    const maxOrder = suppliers.reduce((m, x) => Math.max(m, x.sort_order), -1);
    const { error } = await supabase
      .from("suppliers")
      .update({ archived_at: null, sort_order: maxOrder + 1 })
      .eq("id", id);
    if (!error) {
      setArchived((prev) => prev.filter((x) => x.id !== id));
      setSuppliers((prev) => [...prev, { ...s, archived_at: null, sort_order: maxOrder + 1 }]);
    }
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3.5 border-b flex items-center justify-between">
        <h2 className="font-medium">{title}</h2>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>

      {suppliers.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">No suppliers yet.</div>
      )}

      <ul className="divide-y">
        {suppliers.map((s) => (
          <li key={s.id} className="px-5 py-2.5 flex items-center gap-2">
            <input
              value={s.name}
              disabled={!isAdmin}
              onChange={(e) => setName(s.id, e.target.value)}
              onBlur={() => saveName(s.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="flex-1 h-8 px-2 text-sm rounded-md border bg-background min-w-0 disabled:opacity-60"
            />
            {showKind && (
              <select
                value={s.kind}
                disabled={!isAdmin}
                onChange={(e) => setKind(s.id, e.target.value as SupplierKind)}
                className="shrink-0 h-8 px-2 text-xs rounded-md border bg-background disabled:opacity-60"
              >
                <option value="in_house">In-house</option>
                <option value="outsource">Outsource</option>
              </select>
            )}
            {isAdmin && (
              <button
                onClick={() => handleArchive(s.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                title="Archive supplier"
              >
                <Archive size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {isAdmin && (
        <div className="px-5 py-3 border-t">
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Plus size={14} />
            Add supplier
          </button>
        </div>
      )}

      {isAdmin && archived.length > 0 && (
        <div className="border-t">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="w-full px-5 py-3 flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="divide-y border-t">
              {archived.map((s) => (
                <li key={s.id} className="px-5 py-3 flex items-center justify-between opacity-60">
                  <span className="text-sm">{s.name}</span>
                  <button
                    onClick={() => handleRestore(s.id)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <RotateCcw size={12} />
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
