import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NotificationsPageClient } from "./notifications-client";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="container py-6 md:py-8 px-4 max-w-2xl">
      <h1 className="text-lg font-semibold mb-4">Notifications</h1>
      <NotificationsPageClient
        initialNotifications={notifications || []}
        userId={user.id}
      />
    </div>
  );
}
