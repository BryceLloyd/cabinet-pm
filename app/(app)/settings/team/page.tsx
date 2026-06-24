import { createClient } from "@/lib/supabase/server";
import { TeamList } from "@/components/settings/team-list";
import { CreateUserForm } from "@/components/settings/create-user-form";
import type { ProductionRole } from "@/lib/types";

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
        members={(profiles || []) as { id: string; full_name: string; avatar_url: string | null; role: ProductionRole }[]}
        currentUserId={user!.id}
        isAdmin={isAdmin}
      />

      {isAdmin && (
        <section className="rounded-lg border bg-card">
          <div className="px-5 py-3.5 border-b">
            <h2 className="font-medium">Add team member</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create an account and set their password. Share the email and password — they just log in.
            </p>
          </div>
          <div className="px-5 py-4">
            <CreateUserForm />
          </div>
        </section>
      )}
    </div>
  );
}
