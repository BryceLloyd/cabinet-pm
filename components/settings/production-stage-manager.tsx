"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, X } from "lucide-react";
import type { ProductionStage, ProductionStep } from "@/lib/types";

interface Props {
  stages: ProductionStage[];
  stepsByStage: Record<string, ProductionStep[]>;
  isAdmin: boolean;
}

const GRANULARITY_LABEL: Record<string, string> = {
  material_order: "per material line",
  material_order_painting: "flagged material lines",
  cutlist: "per cutlist",
  room: "per room",
};

export function ProductionStageManager({ stages, stepsByStage, isAdmin }: Props) {
  const supabase = createClient();
  const [stepsMap, setStepsMap] = useState<Record<string, ProductionStep[]>>(stepsByStage);

  const stageNameById = new Map(stages.map((s) => [s.id, s.name]));

  function setStepName(stageId: string, stepId: string, name: string) {
    setStepsMap((prev) => ({
      ...prev,
      [stageId]: prev[stageId].map((s) => (s.id === stepId ? { ...s, name } : s)),
    }));
  }

  async function saveStepName(stageId: string, stepId: string) {
    const step = stepsMap[stageId]?.find((s) => s.id === stepId);
    if (!step || !step.name.trim()) return;
    await supabase.from("production_steps").update({ name: step.name.trim() }).eq("id", stepId);
  }

  async function addStep(stageId: string) {
    const current = stepsMap[stageId] ?? [];
    const maxOrder = current.reduce((m, s) => Math.max(m, s.sort_order), -1);
    const { data, error } = await supabase
      .from("production_steps")
      .insert({ stage_id: stageId, name: "New step", sort_order: maxOrder + 1 })
      .select("*")
      .single();
    if (!error && data) {
      setStepsMap((prev) => ({ ...prev, [stageId]: [...current, data as ProductionStep] }));
      await supabase.rpc("sync_stage_steps", { p_stage_id: stageId });
    }
  }

  async function removeStep(stageId: string, stepId: string) {
    const { error } = await supabase
      .from("production_steps")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", stepId);
    if (!error) {
      setStepsMap((prev) => ({ ...prev, [stageId]: prev[stageId].filter((s) => s.id !== stepId) }));
      await supabase.rpc("sync_stage_steps", { p_stage_id: stageId });
    }
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3.5 border-b">
        <h2 className="font-medium">Sections &amp; steps</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Each section auto-fills from cutlists. Steps are the tick-offs for each item.
        </p>
      </div>

      <ul className="divide-y">
        {stages.map((stage) => {
          const steps = stepsMap[stage.id] ?? [];
          const gateName = stage.gates_on_stage_id ? stageNameById.get(stage.gates_on_stage_id) : null;
          return (
            <li key={stage.id} className="px-5 py-4">
              <div className="flex items-center gap-2 flex-wrap mb-2.5">
                <span className="font-medium text-sm">{stage.name}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {stage.kind === "order" ? "order" : "queue"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {GRANULARITY_LABEL[stage.item_granularity] ?? stage.item_granularity}
                </span>
                {stage.is_parallel ? (
                  <span className="text-[11px] text-muted-foreground">· parallel</span>
                ) : gateName ? (
                  <span className="text-[11px] text-muted-foreground">· after {gateName}</span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">· no gate</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-1 rounded-full border bg-background pl-2.5 pr-1 py-0.5"
                  >
                    <input
                      value={step.name}
                      disabled={!isAdmin}
                      onChange={(e) => setStepName(stage.id, step.id, e.target.value)}
                      onBlur={() => saveStepName(stage.id, step.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      size={Math.max(step.name.length, 4)}
                      className="text-xs bg-transparent outline-none disabled:opacity-70"
                    />
                    {isAdmin && (
                      <button
                        onClick={() => removeStep(stage.id, step.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Remove step"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
                {isAdmin && (
                  <button
                    onClick={() => addStep(stage.id)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline px-2 py-1"
                  >
                    <Plus size={13} />
                    step
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
