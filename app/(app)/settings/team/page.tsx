import { createClient } from "@/lib/supabase/server";
import { InviteManager } from "@/components/settings/invite-manager";

export default async function TeamSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profiles }, { data: profile }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url, role, created_at").order("created_at"),
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
  ]);

  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-6">
      {/* Team members list */}
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Team</h2>
        </div>
        <ul className="divide-y">
          {(profiles || []).map((p) => (
            <li key={p.id} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {(p.full_name || "?").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium">{p.full_name || "—"}</div>
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted capitalize">{p.role}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Allowed emails — admin only */}
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
