import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/types/notifications";

export default async function NotificationSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", user.id)
    .single();

  const prefs = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(profile?.notification_preferences as Record<string, boolean> || {}),
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Notifications</h2>
      <p className="text-sm text-muted-foreground mb-6">Choose which notifications you receive</p>
      <NotificationPreferencesForm userId={user.id} initialPreferences={prefs} />
    </div>
  );
}
