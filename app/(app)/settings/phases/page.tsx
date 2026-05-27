import { createClient } from "@/lib/supabase/server";
import { PhaseManager } from "@/components/settings/phase-manager";

export default async function PhasesSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: phases }, { data: profile }] = await Promise.all([
    supabase.from("phases").select("*").order("sort_order"),
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
  ]);

  const isAdmin = profile?.role === "admin";

  return <PhaseManager initialPhases={phases || []} isAdmin={isAdmin} />;
}
