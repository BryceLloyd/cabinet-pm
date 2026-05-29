import { createClient } from "@/lib/supabase/server";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { PushPrompt } from "@/components/notifications/push-prompt";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <div className="container px-4 pt-4 md:pt-6">
        <PushPrompt />
      </div>
      <DashboardGrid userId={user!.id} />
    </>
  );
}
