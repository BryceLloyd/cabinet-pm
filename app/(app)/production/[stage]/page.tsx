import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { loadStageView } from "@/lib/production/queries";
import { WorkQueue } from "@/components/production/work-queue";
import { CutEdgeList } from "@/components/production/cut-edge-list";
import { FactorySubNav } from "@/components/production/factory-sub-nav";

const FACTORY_STAGES = ["cut-edge", "painting", "assembly"];

export default async function ProductionStagePage({
  params,
}: {
  params: Promise<{ stage: string }>;
}) {
  const { stage: slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const view = await loadStageView(supabase, slug);
  if (!view) notFound();

  const { stage, items } = view;
  const openCount = items.filter((i) => !i.completedAt).length;
  const isFactory = FACTORY_STAGES.includes(stage.slug);

  return (
    <div className="container py-6 md:py-8 px-4">
      {isFactory && <FactorySubNav />}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold">{stage.name}</h1>
        <span className="text-sm text-muted-foreground">{openCount} open</span>
      </div>
      {stage.slug === "cut-edge" ? (
        <CutEdgeList items={items} userId={user.id} />
      ) : (
        <WorkQueue stageName={stage.name} stageSlug={stage.slug} items={items} userId={user.id} />
      )}
    </div>
  );
}
