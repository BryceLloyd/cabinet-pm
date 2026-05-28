"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface TeamMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: "admin" | "member";
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

  async function handleRoleChange(memberId: string, newRole: "admin" | "member") {
    setUpdating(memberId);
    const supabase = createClient();
    await supabase.from("profiles").update({ role: newRole }).eq("id", memberId);
    setUpdating(null);
    router.refresh();
  }

  async function handleRemove(memberId: string) {
    setUpdating(memberId);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ deactivated_at: new Date().toISOString() })
      .eq("id", memberId);
    setUpdating(null);
    setConfirmRemove(null);
    router.refresh();
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3.5 border-b">
        <h2 className="font-medium">Team members</h2>
      </div>
      <ul className="divide-y">
        {members.map((m) => {
          const initials = (m.full_name || "?").slice(0, 2).toUpperCase();
          const isSelf = m.id === currentUserId;
          return (
            <li key={m.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0 overflow-hidden">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="h-8 w-8 object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {m.full_name || "—"}
                    {isSelf && <span className="text-muted-foreground font-normal"> (you)</span>}
                  </div>
                </div>
              </div>
              {isAdmin && !isSelf ? (
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    disabled={updating === m.id}
                    onChange={(e) => handleRoleChange(m.id, e.target.value as "admin" | "member")}
                    className="h-7 px-2 text-xs rounded-md border bg-background cursor-pointer disabled:opacity-50"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>
                  {confirmRemove === m.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRemove(m.id)}
                        disabled={updating === m.id}
                        className="h-7 px-2 text-xs rounded-md bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmRemove(null)}
                        className="h-7 px-2 text-xs rounded-md border hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemove(m.id)}
                      disabled={updating === m.id}
                      className="h-7 px-2 text-xs rounded-md border text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted capitalize">{m.role}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
