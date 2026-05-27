import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, theme_preference, density_preference")
    .eq("id", user!.id)
    .single();

  return (
    <ProfileForm
      userId={user!.id}
      email={user!.email || ""}
      fullName={profile?.full_name || ""}
      avatarUrl={profile?.avatar_url || null}
      themePref={profile?.theme_preference || "system"}
      densityPref={profile?.density_preference || "comfortable"}
    />
  );
}
