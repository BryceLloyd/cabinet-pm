"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductionRole } from "@/lib/types";

const ROLE_OPTIONS: { value: ProductionRole; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "office", label: "Office" },
  { value: "factory", label: "Factory" },
  { value: "site", label: "Site" },
  { value: "admin", label: "Admin" },
];

export function CreateUserForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<ProductionRole>("member");
  const [officeAccess, setOfficeAccess] = useState(true);
  const [productionAccess, setProductionAccess] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAdminRole = role === "admin";

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
        office_access: officeAccess,
        production_access: productionAccess,
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
    setRole("member");
    setOfficeAccess(true);
    setProductionAccess(true);
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
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="text-xs text-muted-foreground">Access:</span>
        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={isAdminRole || officeAccess}
            disabled={isAdminRole}
            onChange={(e) => setOfficeAccess(e.target.checked)}
            className="size-3.5 rounded border-input"
          />
          Office
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={isAdminRole || productionAccess}
            disabled={isAdminRole}
            onChange={(e) => setProductionAccess(e.target.checked)}
            className="size-3.5 rounded border-input"
          />
          Production
        </label>
        {isAdminRole && <span className="text-xs text-muted-foreground">Admins always have both</span>}
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
