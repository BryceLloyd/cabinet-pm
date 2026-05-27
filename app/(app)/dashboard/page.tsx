import { createClient } from "@/lib/supabase/server";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <DashboardGrid userId={user!.id} />;
}
