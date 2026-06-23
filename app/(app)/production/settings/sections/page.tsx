import { createClient } from "@/lib/supabase/server";
import { ProductionStageManager } from "@/components/settings/production-stage-manager";
import type { ProductionStep } from "@/lib/types";

export default async function SectionsSettingsPage() {
  const supabase = await createClient();
  const [stagesRes, stepsRes] = await Promise.all([
    supabase.from("production_stages").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("production_steps").select("*").is("archived_at", null).order("sort_order"),
  ]);
  const stepsByStage: Record<string, ProductionStep[]> = {};
  for (const step of stepsRes.data ?? []) (stepsByStage[step.stage_id] ??= []).push(step);

  return <ProductionStageManager stages={stagesRes.data ?? []} stepsByStage={stepsByStage} isAdmin />;
}
