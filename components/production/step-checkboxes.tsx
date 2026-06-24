"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { StepView } from "@/lib/production/queries";

interface Props {
  steps: StepView[];
  userId: string;
  /** Show each step's name beside its checkbox (default true). When false, only checkboxes render. */
  showLabels?: boolean;
}

/** Renders an item's steps as right-aligned checkboxes. Toggling writes the step and lets the DB trigger roll up item completion. */
export function StepCheckboxes({ steps, userId, showLabels = true }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const sig = useMemo(() => steps.map((s) => `${s.id}:${s.completedAt ? 1 : 0}`).join("|"), [steps]);
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(steps.map((s) => [s.id, !!s.completedAt]))
  );
  useEffect(() => {
    setDoneMap(Object.fromEntries(steps.map((s) => [s.id, !!s.completedAt])));
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(step: StepView) {
    const next = !doneMap[step.id];
    setDoneMap((prev) => ({ ...prev, [step.id]: next }));
    const { error } = await supabase
      .from("production_item_steps")
      .update({ completed_at: next ? new Date().toISOString() : null, completed_by: next ? userId : null })
      .eq("id", step.id);
    if (error) {
      setDoneMap((prev) => ({ ...prev, [step.id]: !next }));
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
      {steps.map((step) => {
        const done = !!doneMap[step.id];
        return (
          <label key={step.id} className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
            {showLabels && <span className={done ? "text-muted-foreground line-through" : "text-muted-foreground"}>{step.name}</span>}
            <input type="checkbox" checked={done} onChange={() => toggle(step)} className="size-4 rounded border-input" />
          </label>
        );
      })}
    </div>
  );
}
