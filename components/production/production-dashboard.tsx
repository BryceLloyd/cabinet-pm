"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { AddCutlistPanel } from "@/components/production/add-cutlist-panel";
import { ActionPill } from "@/components/production/action-pill";
import type { DashboardData, SegmentStatus } from "@/lib/production/queries";
import type { Supplier, Material, PaintType, HardwareCatalogItem } from "@/lib/types";

interface Props {
  data: DashboardData;
  projects: { id: string; name: string }[];
  suppliers: Supplier[];
  materials: Material[];
  paintTypes: PaintType[];
  hardwareCatalog: HardwareCatalogItem[];
  userId: string;
}

const DOT: Record<SegmentStatus, string> = {
  done: "bg-emerald-500",
  progress: "bg-amber-500",
  pending: "bg-muted-foreground/25",
};

export function ProductionDashboard({ data, projects, suppliers, materials, paintTypes, hardwareCatalog, userId }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { metrics, sections, cutlists } = data;

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const metricCards = [
    { label: "Active cutlists", value: metrics.activeCutlists },
    { label: "Items in progress", value: metrics.itemsInProgress },
    { label: "Awaiting order", value: metrics.openOrders },
  ];

  return (
    <div className="container py-6 md:py-8 px-4">
      <h1 className="text-lg font-semibold mb-6">Production</h1>

      <div className="grid grid-cols-3 gap-3 mb-7">
        {metricCards.map((m) => (
          <div key={m.label} className="rounded-md bg-muted/50 px-4 py-3">
            <div className="text-xs text-muted-foreground">{m.label}</div>
            <div className="text-2xl font-semibold">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="text-xs text-muted-foreground mb-2">Section status</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-7">
        {sections.map((s) => (
          <div key={s.slug} className="rounded-lg border bg-card px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{s.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{s.total - s.done} open · {s.done}/{s.total}</span>
            </div>
            {s.preview.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 mt-1">{s.total === 0 ? "Nothing queued" : "All done"}</p>
            ) : (
              <ul className="mt-1.5 space-y-0.5">
                {s.preview.map((p, i) => (
                  <li key={i} className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />{p}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="text-xs text-muted-foreground mb-2">Cutlists in progress</div>
      {cutlists.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No cutlists in progress. Add one to get started.</div>
      ) : (
        <div className="space-y-2">
          {cutlists.map((c) => {
            const open = expanded.has(c.id);
            return (
              <div key={c.id} className="rounded-lg border bg-card">
                <button onClick={() => toggle(c.id)} className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left">
                  <div className="min-w-0 flex items-center gap-2">
                    {open ? <ChevronDown size={15} className="text-muted-foreground shrink-0" /> : <ChevronRight size={15} className="text-muted-foreground shrink-0" />}
                    <div className="min-w-0">
                      <span className="font-medium">{c.projectName}</span>
                      <span className="text-muted-foreground"> · {c.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {c.currentStageName && <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">{c.currentStageName}</span>}
                    <div className="hidden sm:flex gap-1">
                      {c.sections.map((s) => <span key={s.slug} title={`${s.name}: ${s.status}`} className={`w-5 h-1.5 rounded-full ${DOT[s.status]}`} />)}
                    </div>
                  </div>
                </button>
                {open && (
                  <div className="px-4 pb-3 pt-0 border-t">
                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 pt-3">
                      {c.sections.map((s) => (
                        <div key={s.slug} className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <span className={`w-2 h-2 rounded-full ${DOT[s.status]}`} />{s.name}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">{s.total === 0 ? "—" : `${s.done}/${s.total}`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ActionPill label="Add cutlist" onClick={() => setAddOpen(true)} />
      <AddCutlistPanel open={addOpen} onClose={() => setAddOpen(false)} projects={projects} suppliers={suppliers} materials={materials} paintTypes={paintTypes} hardwareCatalog={hardwareCatalog} userId={userId} />
    </div>
  );
}
