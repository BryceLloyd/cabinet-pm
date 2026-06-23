"use client";

import { DraggableList } from "@/components/production/draggable-list";
import { CompletedSection } from "@/components/production/completed-section";
import { ItemRow } from "@/components/production/work-queue";
import type { ItemView } from "@/lib/production/queries";

function Queue({ title, slug, items, userId }: { title: string; slug: string; items: ItemView[]; userId: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{title}</div>
      <div className="space-y-1.5">
        <DraggableList id={`ce-${slug}`} items={items} table="production_items" renderItem={(it, handle) => <ItemRow item={it} userId={userId} handle={handle} />} />
      </div>
    </div>
  );
}

export function CutEdgeList({ items, userId }: { items: ItemView[]; userId: string }) {
  const inHouse = items.filter((i) => i.supplierKind !== "outsource" && !i.completedAt);
  const outsource = items.filter((i) => i.supplierKind === "outsource" && !i.completedAt);
  const completed = items.filter((i) => i.completedAt);

  if (items.length === 0) {
    return <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">Nothing in the Cut &amp; edge list yet.</div>;
  }

  return (
    <div className="space-y-5">
      <Queue title="In-house" slug="inhouse" items={inHouse} userId={userId} />
      <Queue title="Outsource" slug="outsource" items={outsource} userId={userId} />
      <CompletedSection count={completed.length}>
        {completed.map((it) => <ItemRow key={it.id} item={it} userId={userId} done />)}
      </CompletedSection>
    </div>
  );
}
