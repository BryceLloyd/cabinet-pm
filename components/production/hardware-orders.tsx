"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AddHardwareOrderPanel } from "@/components/production/add-hardware-order-panel";
import { CompletedSection } from "@/components/production/completed-section";
import { ActionPill } from "@/components/production/action-pill";
import type { HardwareBatch } from "@/lib/production/queries";
import type { Supplier, HardwareCatalogItem, HardwareItemStatus } from "@/lib/types";

interface Props {
  batches: HardwareBatch[];
  cutlists: { id: string; label: string }[];
  suppliers: Supplier[];
  hardwareCatalog: HardwareCatalogItem[];
  userId: string;
  canPlace: boolean;
}

const PILL: Record<HardwareItemStatus, { label: string; cls: string }> = {
  to_order: { label: "To order", cls: "bg-muted text-muted-foreground" },
  ordered: { label: "Ordered", cls: "bg-amber-50 text-amber-700" },
  received: { label: "Received", cls: "bg-emerald-50 text-emerald-700" },
};

function BatchCard({ batch, userId, canPlace, done }: { batch: HardwareBatch; userId: string; canPlace: boolean; done?: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<HardwareItemStatus>(batch.status);
  const ordered = status !== "to_order";
  const received = status === "received";

  async function update(next: HardwareItemStatus) {
    const prev = status;
    setStatus(next);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> =
      next === "to_order" ? { status: next, ordered_at: null, received_at: null, completed_by: null }
      : next === "ordered" ? { status: next, ordered_at: now, received_at: null, completed_by: null }
      : { status: next, ordered_at: now, received_at: now, completed_by: userId };
    const { error } = await supabase.from("hardware_order_items").update(patch).in("id", batch.itemIds);
    if (error) { setStatus(prev); return; }
    router.refresh();
  }

  const pill = PILL[status];
  return (
    <div className={`rounded-md border bg-card px-3 py-2 ${done ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-semibold truncate w-full md:w-auto md:flex-1">{batch.cutlistLabel ?? batch.orderTitle}</span>
        <div className="flex items-center gap-2.5 ml-auto shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${pill.cls}`}>{pill.label}</span>
          {canPlace && (
            <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">Ordered<input type="checkbox" checked={ordered} onChange={() => update(ordered ? "to_order" : "ordered")} className="size-4 rounded border-input" /></label>
          )}
          {/* Factory may mark received, but not un-receive (that would set it back to "ordered"). */}
          <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">Received<input type="checkbox" checked={received} disabled={!canPlace && received} onChange={() => update(received ? "ordered" : "received")} className="size-4 rounded border-input disabled:opacity-50" /></label>
        </div>
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        {batch.items.map((i) => <li key={i.id} className="rounded bg-muted px-1.5 py-0.5">{i.name}{i.qty ? ` ×${i.qty}` : ""}</li>)}
      </ul>
    </div>
  );
}

export function HardwareOrders({ batches, cutlists, suppliers, hardwareCatalog, userId, canPlace }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const active = batches.filter((b) => b.status !== "received");
  const completed = batches.filter((b) => b.status === "received");

  const order: string[] = [];
  const bySupplier = new Map<string, HardwareBatch[]>();
  for (const b of active) {
    const key = b.supplierName ?? "No supplier";
    const list = bySupplier.get(key) ?? [];
    if (list.length === 0) order.push(key);
    list.push(b);
    bySupplier.set(key, list);
  }

  return (
    <div className="space-y-5">
      {batches.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No hardware orders yet.</div>
      ) : (
        <>
          <div className="space-y-4">
            {order.map((sup) => (
              <div key={sup}>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{sup}</div>
                <div className="space-y-1.5">
                  {bySupplier.get(sup)!.map((b) => <BatchCard key={b.key} batch={b} userId={userId} canPlace={canPlace} />)}
                </div>
              </div>
            ))}
            {active.length === 0 && <p className="text-sm text-muted-foreground">All hardware received.</p>}
          </div>

          <CompletedSection count={completed.length}>
            {completed.map((b) => <BatchCard key={b.key} batch={b} userId={userId} canPlace={canPlace} done />)}
          </CompletedSection>
        </>
      )}

      {canPlace && (
        <>
          <ActionPill label="New hardware order" onClick={() => setAddOpen(true)} />
          <AddHardwareOrderPanel open={addOpen} onClose={() => setAddOpen(false)} cutlists={cutlists} suppliers={suppliers} hardwareCatalog={hardwareCatalog} userId={userId} />
        </>
      )}
    </div>
  );
}
