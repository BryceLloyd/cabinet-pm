"use client";

import { StepCheckboxes } from "@/components/production/step-checkboxes";
import { DraggableList } from "@/components/production/draggable-list";
import { CompletedSection } from "@/components/production/completed-section";
import type { ItemView } from "@/lib/production/queries";

interface Props {
  stageName: string;
  stageSlug: string;
  items: ItemView[];
  userId: string;
}

export function ItemRow({ item, userId, handle, done }: { item: ItemView; userId: string; handle?: React.ReactNode; done?: boolean }) {
  const detail = item.label && item.label !== item.cutlistName ? item.label : null;
  return (
    <div className={`rounded-md border bg-card px-3 py-1.5 ${done ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="flex items-center gap-2 min-w-0 w-full md:w-auto md:flex-1">
          {handle}
          <span className="text-sm min-w-0 truncate">
            <span className={`font-semibold ${done ? "line-through font-normal text-muted-foreground" : ""}`}>{item.projectName}</span>
            <span className="text-muted-foreground"> · {item.cutlistName}</span>
            {detail && <span className={done ? "text-muted-foreground" : ""}> · <span className="font-medium">{detail}</span></span>}
          </span>
        </span>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {item.supplierName && <span className="text-[11px] text-muted-foreground">{item.supplierName}</span>}
          {item.paintTypeName && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{item.paintTypeName}</span>}
          <StepCheckboxes steps={item.steps} userId={userId} />
        </div>
      </div>
    </div>
  );
}

export function WorkQueue({ stageName, stageSlug, items, userId }: Props) {
  const active = items.filter((i) => !i.completedAt);
  const completed = items.filter((i) => i.completedAt);

  return (
    <div className="space-y-5">
      {active.length === 0 && completed.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">Nothing in the {stageName} queue yet.</div>
      ) : (
        <div className="space-y-1.5">
          <DraggableList id={`wq-${stageSlug}`} items={active} table="production_items" renderItem={(it, handle) => <ItemRow item={it} userId={userId} handle={handle} />} />
          {active.length === 0 && <p className="text-sm text-muted-foreground">Everything here is complete.</p>}
        </div>
      )}

      <CompletedSection count={completed.length}>
        {completed.map((it) => <ItemRow key={it.id} item={it} userId={userId} done />)}
      </CompletedSection>
    </div>
  );
}
