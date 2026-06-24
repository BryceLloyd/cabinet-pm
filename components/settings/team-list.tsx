"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ProductionRole } from "@/lib/types";

const ROLE_OPTIONS: { value: ProductionRole; label: string; blurb: string }[] = [
  { value: "admin", label: "Admin", blurb: "Everything — plus team & system settings" },
  { value: "office", label: "Office", blurb: "Office + Production; manages jobs, orders & production settings" },
  { value: "factory", label: "Factory", blurb: "Production floor — completes items & receives orders" },
  { value: "site", label: "Site", blurb: "Installation only — completes install items" },
];

interface TeamMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: ProductionRole;
}

export function TeamList({
  members,
  currentUserId,
  isAdmin,
}: {
  members: TeamMember[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  async function handleRoleChange(memberId: string, newRole: ProductionRole) {
    setUpdating(memberId);
    const supabase = createClient();
    await supabase.from("profiles").update({ role: newRole }).eq("id", memberId);
    setUpdating(null);
    router.refresh();
  }

  async function handleRemove(memberId: string) {
    setUpdating(memberId);
    const supabase = createClient();
    await supabase.from("profiles").update({ deactivated_at: new Date().toISOString() }).eq("id", memberId);
    setUpdating(null);
    setConfirmRemove(null);
    router.refresh();
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3.5 border-b">
        <h2 className="font-medium">Team members</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Each person&apos;s role decides what they can see and do.</p>
      </div>
      <ul className="divide-y">
        {members.map((m) => {
          const initials = (m.full_name || "?").slice(0, 2).toUpperCase();
          const isSelf = m.id === currentUserId;
          const blurb = ROLE_OPTIONS.find((r) => r.value === m.role)?.blurb ?? "";
          return (
            <li key={m.id} className="px-5 py-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0 overflow-hidden">
                {m.avatar_url ? <img src={m.avatar_url} alt="" className="h-8 w-8 object-cover" /> : initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {m.full_name || "—"}
                  {isSelf && <span className="text-muted-foreground font-normal"> (you)</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{blurb}</div>
              </div>
              {isAdmin && !isSelf ? (
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={m.role}
                    disabled={updating === m.id}
                    onChange={(e) => handleRoleChange(m.id, e.target.value as ProductionRole)}
                    className="h-7 px-2 text-xs rounded-md border bg-background cursor-pointer disabled:opacity-50"
                  >
                    {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  {confirmRemove === m.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleRemove(m.id)} disabled={updating === m.id} className="h-7 px-2 text-xs rounded-md bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50">Confirm</button>
                      <button onClick={() => setConfirmRemove(null)} className="h-7 px-2 text-xs rounded-md border hover:bg-muted">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmRemove(m.id)} disabled={updating === m.id} className="h-7 px-2 text-xs rounded-md border text-destructive hover:bg-destructive/10 disabled:opacity-50">Remove</button>
                  )}
                </div>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted capitalize shrink-0">{m.role}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
