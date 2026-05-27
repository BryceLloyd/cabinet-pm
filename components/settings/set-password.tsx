"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match");
      setStatus("error");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setStatus("error");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("success");
      setPassword("");
      setConfirm("");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
      <p className="text-xs text-muted-foreground">
        Set or change your password so you can sign in without a magic link.
      </p>
      <input
        type="password"
        required
        value={password}
        onChange={(e) => { setPassword(e.target.value); setStatus("idle"); }}
        placeholder="New password"
        className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <input
        type="password"
        required
        value={confirm}
        onChange={(e) => { setConfirm(e.target.value); setStatus("idle"); }}
        placeholder="Confirm password"
        className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={loading}
        className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >{loading ? "Saving…" : "Set password"}</button>
      {status === "success" && <p className="text-sm text-emerald-600">Password updated.</p>}
      {status === "error" && error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
