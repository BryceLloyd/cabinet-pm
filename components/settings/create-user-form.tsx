"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductionRole } from "@/lib/types";

const ROLE_OPTIONS: { value: ProductionRole; label: string; blurb: string }[] = [
  { value: "office", label: "Office", blurb: "Office + Production; manages jobs, orders & production settings" },
  { value: "factory", label: "Factory", blurb: "Production floor — completes items & receives orders" },
  { value: "site", label: "Site", blurb: "Installation only — completes install items" },
  { value: "admin", label: "Admin", blurb: "Everything — plus team & system settings" },
];

export function CreateUserForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<ProductionRole>("office");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const roleBlurb = ROLE_OPTIONS.find((r) => r.value === role)?.blurb ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
        role,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error || "Failed to create user");
      setLoading(false);
      return;
    }

    setSuccess(`${email} can now sign in with the password you set.`);
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("office");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="cu-name" className="block text-xs font-medium mb-1">Full name</label>
          <input
            id="cu-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label htmlFor="cu-email" className="block text-xs font-medium mb-1">Email</label>
          <input
            id="cu-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@woodenwonders.co.za"
            className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label htmlFor="cu-password" className="block text-xs font-medium mb-1">Password</label>
          <input
            id="cu-password"
            type="text"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label htmlFor="cu-role" className="block text-xs font-medium mb-1">Role</label>
          <select
            id="cu-role"
            value={role}
            onChange={(e) => setRole(e.target.value as ProductionRole)}
            className="w-full h-9 px-3 rounded-md border bg-background text-sm"
          >
            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <p className="text-xs text-muted-foreground mt-1">{roleBlurb}</p>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >{loading ? "Creating…" : "Create user"}</button>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}
    </form>
  );
}
