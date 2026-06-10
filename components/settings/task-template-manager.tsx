"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type { TaskTemplate } from "@/lib/types";

interface Props {
  initialTemplates: TaskTemplate[];
  userId: string;
}

export function TaskTemplateManager({ initialTemplates, userId }: Props) {
  const supabase = createClient();
  const [templates, setTemplates] = useState<TaskTemplate[]>(initialTemplates);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Local text for the per-template items editor (one item per line).
  const [itemsText, setItemsText] = useState<Record<string, string>>(
    Object.fromEntries(initialTemplates.map((t) => [t.id, t.items.join("\n")])),
  );

  async function handleAdd() {
    const maxOrder = templates.reduce((max, t) => Math.max(max, t.sort_order), -1);
    const { data, error } = await supabase
      .from("task_templates")
      .insert({ name: "New template", items: [], sort_order: maxOrder + 1, created_by: userId })
      .select("*")
      .single();
    if (!error && data) {
      const tpl = data as TaskTemplate;
      setTemplates((prev) => [...prev, tpl]);
      setItemsText((prev) => ({ ...prev, [tpl.id]: "" }));
      setExpanded(tpl.id);
    }
  }

  function handleNameChange(id: string, name: string) {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
  }

  async function handleNameBlur(id: string) {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl || !tpl.name.trim()) return;
    await supabase.from("task_templates").update({ name: tpl.name.trim() }).eq("id", id);
  }

  async function handleItemsBlur(id: string) {
    const items = (itemsText[id] || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, items } : t)));
    await supabase.from("task_templates").update({ items }).eq("id", id);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template? Tasks already created from it are unaffected.")) return;
    const { error } = await supabase.from("task_templates").delete().eq("id", id);
    if (!error) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    }
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3.5 border-b flex items-center justify-between">
        <div>
          <h2 className="font-medium">Task templates</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reusable checklists you can apply to any task.
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md border text-xs text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
        >
          <Plus size={13} />
          Add
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          No templates yet. Add one to create a reusable checklist.
        </div>
      ) : (
        <ul className="divide-y">
          {templates.map((tpl) => {
            const isOpen = expanded === tpl.id;
            return (
              <li key={tpl.id} className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpanded(isOpen ? null : tpl.id)}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    aria-label={isOpen ? "Collapse" : "Expand"}
                  >
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <input
                    value={tpl.name}
                    onChange={(e) => handleNameChange(tpl.id, e.target.value)}
                    onBlur={() => handleNameBlur(tpl.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className="flex-1 h-8 px-2 text-sm font-medium rounded-md border border-transparent hover:border-border focus:border-border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring min-w-0"
                  />
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {tpl.items.length} item{tpl.items.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => handleDelete(tpl.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Delete template"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-2 pl-6">
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      Checklist items (one per line)
                    </label>
                    <textarea
                      value={itemsText[tpl.id] ?? ""}
                      onChange={(e) => setItemsText((prev) => ({ ...prev, [tpl.id]: e.target.value }))}
                      onBlur={() => handleItemsBlur(tpl.id)}
                      rows={Math.max(4, (itemsText[tpl.id] || "").split("\n").length)}
                      placeholder={"Measure site\nProduce cutlist\nOrder hardware"}
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
