import { getUser } from "@/lib/supabase/server";
import { getDashboardCardData } from "@/lib/dashboard/server-data";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { PushPrompt } from "@/components/notifications/push-prompt";

export default async function DashboardPage() {
  const user = await getUser();
  const cardData = await getDashboardCardData(user!.id);

  return (
    <>
      <div className="container px-4 pt-4 md:pt-6">
        <PushPrompt />
      </div>
      <DashboardGrid userId={user!.id} cardData={cardData} />
    </>
  );
}
