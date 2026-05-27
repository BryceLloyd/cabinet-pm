import { createClient } from "@/lib/supabase/server";
import { EventTypeManager } from "@/components/settings/event-type-manager";

export default async function EventTypesSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: eventTypes }, { data: profile }] = await Promise.all([
    supabase.from("event_types").select("*").order("sort_order"),
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
  ]);

  const isAdmin = profile?.role === "admin";

  return <EventTypeManager initialEventTypes={eventTypes || []} isAdmin={isAdmin} />;
}
