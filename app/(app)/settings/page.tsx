import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: profiles }, { data: phases }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("phases").select("*").order("sort_order"),
  ]);

  return (
    <div className="container py-6 md:py-8 px-4 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Settings</h1>

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
        <div className="px-5 py-3 text-xs text-muted-foreground border-t">
          To add a team member: have them sign in via magic link, then edit their profile in the Supabase dashboard.
        </div>
      </section>

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
        <div className="px-5 py-3 text-xs text-muted-foreground border-t">
          Phase editing UI coming next. For now, edit directly in the Supabase <code className="text-xs">phases</code> table.
        </div>
      </section>
    </div>
  );
}
