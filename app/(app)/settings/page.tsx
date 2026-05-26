import { createClient } from "@/lib/supabase/server";
import { InviteManager } from "@/components/settings/invite-manager";
import { SetPassword } from "@/components/settings/set-password";
import { BusinessInfoForm } from "@/components/settings/business-info-form";
import type { BusinessInfo } from "@/lib/types";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profiles }, { data: phases }, { data: profile }, { data: businessInfo }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("phases").select("*").order("sort_order"),
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
    supabase.from("business_info").select("*").eq("id", 1).single(),
  ]);

  const isAdmin = profile?.role === "admin";

  const biz: BusinessInfo = businessInfo || {
    id: 1, name: "", logo_url: null, address: null, phone: null,
    email: null, workshop_photo_url: null, updated_at: "",
  };

  return (
    <div className="container py-6 md:py-8 px-4 max-w-3xl">
      <h1 className="text-xl md:text-2xl font-semibold tracking-tight mb-6">Settings</h1>

      {/* Business info */}
      <section className="rounded-lg border bg-card mb-6">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Business info</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Appears on the login screen, nav bar, and dashboard.
          </p>
        </div>
        <div className="px-5 py-4">
          <BusinessInfoForm initial={biz} isAdmin={isAdmin} />
        </div>
      </section>

      {/* Set password */}
      <section className="rounded-lg border bg-card mb-6">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Your password</h2>
        </div>
        <div className="px-5 py-4">
          <SetPassword />
        </div>
      </section>

      {/* Team members */}
      <section className="rounded-lg border bg-card mb-6">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Team</h2>
        </div>
        <ul className="divide-y">
          {(profiles || []).map((p) => (
            <li key={p.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{p.full_name || "—"}</div>
                <div className="text-xs text-muted-foreground">{p.id.slice(0, 8)}…</div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted capitalize">{p.role}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Invite management — admin only */}
      {isAdmin && (
        <section className="rounded-lg border bg-card mb-6">
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

      {/* Phases */}
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Phases</h2>
        </div>
        <ul className="divide-y">
          {(phases || []).map((p) => (
            <li key={p.id} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
                <span className="text-sm font-medium">{p.name}</span>
                {p.is_default && <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">default</span>}
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">#{p.sort_order}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
