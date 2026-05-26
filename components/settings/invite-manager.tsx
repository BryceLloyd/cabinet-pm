"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AllowedEmail {
  id: string;
  email: string;
  default_role: string;
  created_at: string;
}

export function InviteManager() {
  const [emails, setEmails] = useState<AllowedEmail[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("allowed_emails")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setEmails(data);
  }

  async function addEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("allowed_emails").insert({
      email: newEmail.toLowerCase().trim(),
      default_role: newRole,
      invited_by: user?.id,
    });
    if (error) {
      setError(error.message.includes("duplicate") ? "Email already added" : error.message);
    } else {
      setNewEmail("");
      setNewRole("member");
      await load();
    }
    setLoading(false);
  }

  async function removeEmail(id: string) {
    await supabase.from("allowed_emails").delete().eq("id", id);
    await load();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addEmail} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="team@example.com"
          className="flex-1 h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          className="h-9 px-3 rounded-md border bg-background text-sm"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
        >{loading ? "Adding…" : "Add email"}</button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <ul className="divide-y rounded-md border">
        {emails.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted-foreground text-center">No allowed emails yet.</li>
        )}
        {emails.map((e) => (
          <li key={e.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm truncate">{e.email}</div>
              <div className="text-xs text-muted-foreground capitalize">{e.default_role}</div>
            </div>
            <button
              onClick={() => removeEmail(e.id)}
              className="text-xs text-muted-foreground hover:text-destructive shrink-0"
            >Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
