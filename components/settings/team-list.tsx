"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ProductionRole } from "@/lib/types";

const ROLE_OPTIONS: { value: ProductionRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "office", label: "Office" },
  { value: "factory", label: "Factory" },
  { value: "site", label: "Site" },
  { value: "member", label: "Member" },
];

interface TeamMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: ProductionRole;
  office_access: boolean;
  production_access: boolean;
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

  async function handleAccessChange(memberId: string, field: "office_access" | "production_access", value: boolean) {
    setUpdating(memberId);
    const supabase = createClient();
    await supabase.from("profiles").update({ [field]: value }).eq("id", memberId);
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
        <p className="text-xs text-muted-foreground mt-0.5">Grant access to the Office and Production views per person. Admins always have both.</p>
      </div>
      <ul className="divide-y">
        {members.map((m) => {
          const initials = (m.full_name || "?").slice(0, 2).toUpperCase();
          const isSelf = m.id === currentUserId;
          const adminMember = m.role === "admin";
          const office = adminMember || m.office_access;
          const production = adminMember || m.production_access;
          return (
            <li key={m.id} className="px-5 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0 overflow-hidden">
                  {m.avatar_url ? <img src={m.avatar_url} alt="" className="h-8 w-8 object-cover" /> : initials}
                </div>
                <div className="text-sm font-medium truncate">
                  {m.full_name || "—"}
                  {isSelf && <span className="text-muted-foreground font-normal"> (you)</span>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 pl-11">
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={office} disabled={!isAdmin || adminMember || updating === m.id} onChange={(e) => handleAccessChange(m.id, "office_access", e.target.checked)} className="size-3.5 rounded border-input" />
                    Office
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={production} disabled={!isAdmin || adminMember || updating === m.id} onChange={(e) => handleAccessChange(m.id, "production_access", e.target.checked)} className="size-3.5 rounded border-input" />
                    Production
                  </label>
                </div>

                {isAdmin && !isSelf ? (
                  <div className="flex items-center gap-2 ml-auto">
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
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted capitalize ml-auto">{m.role}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
