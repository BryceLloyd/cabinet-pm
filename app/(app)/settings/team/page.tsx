import { createClient } from "@/lib/supabase/server";
import { TeamList } from "@/components/settings/team-list";
import { InviteManager } from "@/components/settings/invite-manager";

export default async function TeamSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profiles }, { data: profile }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url, role").is("deactivated_at", null).order("created_at"),
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
  ]);

  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-6">
      <TeamList
        members={(profiles || []) as { id: string; full_name: string; avatar_url: string | null; role: "admin" | "member" }[]}
        currentUserId={user!.id}
        isAdmin={isAdmin}
      />

      {isAdmin && (
        <section className="rounded-lg border bg-card">
          <div className="px-5 py-3.5 border-b">
            <h2 className="font-medium">Allowed emails</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Only these emails can sign up. Add someone before they create an account.
            </p>
          </div>
          <div className="px-5 py-4">
            <InviteManager />
          </div>
        </section>
      )}
    </div>
  );
}
