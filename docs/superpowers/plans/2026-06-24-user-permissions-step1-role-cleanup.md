# User Permissions — Step 1: Role Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the permission model to four roles (Admin / Office / Factory / Site) where role alone decides view + capability access, removing the `office_access` / `production_access` toggles and the legacy `member` role.

**Architecture:** A migration migrates `member → office`, tightens the role check constraint, and drops the two boolean columns. `lib/production/access.ts` becomes the single source of role→view logic; middleware and layouts derive view access from role instead of the dropped columns. The Team and Add-user UIs become role-only.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Supabase (Postgres + RLS), `@supabase/ssr`. No unit-test runner exists in this repo — verification is `npx tsc --noEmit` plus live preview behaviour per role (the project's established practice).

**Scope note:** This is Step 1 of two. It cleans up the role *model* and *view gating*. Database write lock-down (RLS + status RPCs) is Step 2, a separate plan/PR. After Step 1 the DB is still permissive.

**Branch:** `claude/user-permissions`, stacked on `claude/admin-create-users` (PR #8). Merges after #8.

---

### Task 1: Migration — collapse roles (deploy-safe; columns kept)

**Files:**
- Create: `supabase/migrations/027_simplify_roles.sql`

**Why no column drop here:** the live site (deployed from `master`) still `SELECT`s `office_access` / `production_access`. Dropping them now would error the running app before the new code ships. So 027 only does changes that are safe for the currently-deployed code; the columns stay as unused leftovers and are dropped in a follow-up migration *after* this PR deploys (see "Deployment coordination" at the end).

- [ ] **Step 1: Write the migration**

```sql
-- Migration 027: Simplify roles (deploy-safe subset)
-- Four roles only (admin/office/factory/site); role alone decides view +
-- capability access. We migrate 'member' -> 'office' and tighten the role
-- check constraint. We do NOT drop office_access/production_access here: the
-- currently-deployed app still reads them. They become unused leftovers and
-- are dropped in a later migration once this code is live.

-- 1. Migrate existing 'member' accounts to 'office'.
update public.profiles set role = 'office' where role = 'member';

-- 2. Remove the 'member' default from any allowed_emails so the deployed
--    self-signup trigger can't insert a now-invalid role.
update public.allowed_emails set default_role = 'office' where default_role = 'member';

-- 3. Tighten the role check constraint (drop 'member'). Safe for old code:
--    nothing writes 'member' after steps 1-2.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'office', 'factory', 'site'));
```

- [ ] **Step 2: Do NOT push during development**

Do **not** run `supabase db push` while building. This migration applies at deploy time (see "Deployment coordination"). Verification (Task 6) uses throwaway test users so the live schema/data is never touched during the build.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/027_simplify_roles.sql
git commit -m "feat(db): migration 027 - migrate member->office, tighten role constraint"
```

---

### Task 2: Types + access helpers

**Files:**
- Modify: `lib/types.ts:6` and `lib/types.ts:13-14`
- Modify: `lib/production/access.ts` (whole file)

- [ ] **Step 1: Drop `member` from `ProductionRole` and remove the toggle fields from `Profile`**

In `lib/types.ts`, replace line 6:

```ts
export type ProductionRole = "admin" | "office" | "factory" | "site";
```

And in the `Profile` interface, delete these two lines:

```ts
  office_access: boolean;
  production_access: boolean;
```

- [ ] **Step 2: Rewrite `lib/production/access.ts`**

```ts
import type { ProductionRole } from "@/lib/types";

// Which production section slugs each role may see. 'all' = every section.
const STAGE_ACCESS: Record<ProductionRole, "all" | string[]> = {
  admin: "all",
  office: "all",
  factory: ["cut-edge", "painting", "assembly", "hardware-orders"],
  site: ["installation"],
};

export function canSeeStage(role: string, slug: string): boolean {
  const access = STAGE_ACCESS[role as ProductionRole] ?? [];
  return access === "all" || access.includes(slug);
}

// Office and Admin see the Office view (dashboard, projects, tasks, calendar).
export function canSeeOffice(role: string): boolean {
  return role === "admin" || role === "office";
}

// Every role can reach the Production area (each sees at least one section).
export function canSeeProduction(role: string): boolean {
  const access = STAGE_ACCESS[role as ProductionRole];
  return access === "all" || (Array.isArray(access) && access.length > 0);
}

// Production settings (materials, suppliers, hardware, paint) — office + admin.
export function canSeeProductionSettings(role: string): boolean {
  return role === "admin" || role === "office";
}

// Site users work a single section; everyone else gets the overview dashboard.
export function canSeeProductionDashboard(role: string): boolean {
  return role !== "site";
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: errors only in files that still reference `office_access` / `production_access` (those are fixed in Tasks 3–5). Note them; they are expected at this point.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/production/access.ts
git commit -m "feat(access): four-role helpers; office can see production settings"
```

---

### Task 3: View gating — middleware + layouts derive from role

**Files:**
- Modify: `middleware.ts:40-58` (the profile/view-access block) + import
- Modify: `app/(app)/layout.tsx:18-21` (select) and `:45-47` (derive) + import + UserMenu prop
- Modify: `app/(app)/production/layout.tsx:9-15` + import
- Modify: `app/(app)/production/settings/layout.tsx:11`

- [ ] **Step 1: `middleware.ts` — fetch only `role`, derive view access**

Add to the imports at the top of `middleware.ts`:

```ts
import { canSeeOffice, canSeeProduction } from "@/lib/production/access";
```

Replace the `if (user && !isAuthPage && !path.startsWith("/auth")) { ... }` block with:

```ts
  // Office / Production view access derived from role.
  if (user && !isAuthPage && !path.startsWith("/auth")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile) {
      const office = canSeeOffice(profile.role);
      const production = canSeeProduction(profile.role);
      const isProduction = path === "/production" || path.startsWith("/production/");
      if (isProduction && !production && office) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      if (!isProduction && !office && production) {
        return NextResponse.redirect(new URL("/production", request.url));
      }
    }
  }
```

- [ ] **Step 2: `app/(app)/layout.tsx` — derive from role**

Add to imports:

```ts
import { canSeeOffice, canSeeProduction, canSeeProductionSettings } from "@/lib/production/access";
```

Change the profiles select (line 19) to drop the two columns:

```ts
    supabase.from("profiles").select("full_name, role, avatar_url, density_preference, deactivated_at").eq("id", user.id).single(),
```

Replace the access derivation (lines 45-47):

```ts
  const isAdmin = profile.role === "admin";
  const hasOffice = canSeeOffice(profile.role);
  const hasProduction = canSeeProduction(profile.role);
```

Change the `UserMenu` prop `showProductionSettings={isAdmin && hasProduction}` to:

```ts
            showProductionSettings={canSeeProductionSettings(profile.role) && hasProduction}
```

- [ ] **Step 3: `app/(app)/production/layout.tsx` — derive from role**

Replace the body of the function (lines 9-15) with:

```ts
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const hasProduction = canSeeProduction(profile?.role ?? "");
  if (!hasProduction) redirect("/dashboard");
```

Add to imports:

```ts
import { canSeeProduction } from "@/lib/production/access";
```

- [ ] **Step 4: `app/(app)/production/settings/layout.tsx` — clean fallback**

Replace line 11:

```ts
  if (!canSeeProductionSettings(profile?.role ?? "")) redirect("/production");
```

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: remaining errors only in `team-list.tsx`, `settings/team/page.tsx`, `create-user-form.tsx`, `api/users/create/route.ts` (fixed in Tasks 4–5).

- [ ] **Step 6: Commit**

```bash
git add middleware.ts "app/(app)/layout.tsx" "app/(app)/production/layout.tsx" "app/(app)/production/settings/layout.tsx"
git commit -m "feat(access): derive Office/Production view access from role"
```

---

### Task 4: Team list — role-only, with role legend

**Files:**
- Modify: `components/settings/team-list.tsx` (whole file)
- Modify: `app/(app)/settings/team/page.tsx:9-21`

- [ ] **Step 1: Rewrite `components/settings/team-list.tsx`**

```tsx
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
```

- [ ] **Step 2: Update `app/(app)/settings/team/page.tsx`**

Change the profiles select (line 10) to drop the columns:

```ts
    supabase.from("profiles").select("id, full_name, avatar_url, role").is("deactivated_at", null).order("created_at"),
```

Change the `members` prop cast (line 19) to:

```ts
        members={(profiles || []) as { id: string; full_name: string; avatar_url: string | null; role: ProductionRole }[]}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: remaining errors only in `create-user-form.tsx` and `api/users/create/route.ts`.

- [ ] **Step 4: Commit**

```bash
git add components/settings/team-list.tsx "app/(app)/settings/team/page.tsx"
git commit -m "feat(team): role-only management with per-role descriptions"
```

---

### Task 5: Add-user form + route — role-only

**Files:**
- Modify: `components/settings/create-user-form.tsx`
- Modify: `app/api/users/create/route.ts`

- [ ] **Step 1: `create-user-form.tsx` — drop `member`, drop access checkboxes**

Replace the `ROLE_OPTIONS` array so `member` is gone and order matches the team list:

```tsx
const ROLE_OPTIONS: { value: ProductionRole; label: string }[] = [
  { value: "office", label: "Office" },
  { value: "factory", label: "Factory" },
  { value: "site", label: "Site" },
  { value: "admin", label: "Admin" },
];
```

Change the role state default (was `"member"`):

```tsx
  const [role, setRole] = useState<ProductionRole>("office");
```

Delete the `officeAccess` / `productionAccess` state declarations and the `isAdminRole` line is no longer needed for the access checkboxes — remove the entire "Access" block (`<div className="flex items-center gap-4 text-sm">…</div>`) from the JSX.

In `handleSubmit`, change the request body to drop the two access fields:

```tsx
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
        role,
      }),
```

In the success reset, change `setRole("member")` to `setRole("office")` and delete the `setOfficeAccess(true)` / `setProductionAccess(true)` lines.

- [ ] **Step 2: `app/api/users/create/route.ts` — role-only**

Replace the `ROLES` constant (line 5):

```ts
const ROLES = ["admin", "office", "factory", "site"] as const;
```

Change the role fallback (line 35) and delete the `officeAccess` / `productionAccess` lines (36-37):

```ts
  const role: Role = ROLES.includes(body.role) ? body.role : "office";
```

Replace the profile upsert object so it no longer sets the dropped columns:

```ts
  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: created.user.id,
      full_name: fullName || email.split("@")[0],
      role,
      deactivated_at: null,
    },
    { onConflict: "id" }
  );
```

- [ ] **Step 3: Type check (clean)**

Run: `npx tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 4: Commit**

```bash
git add components/settings/create-user-form.tsx app/api/users/create/route.ts
git commit -m "feat(team): create-user form is role-only (no access toggles)"
```

---

### Task 6: Verify per-role behaviour in preview

No unit-test runner exists; verify live. Create one temp user per role via the GoTrue admin API + a profile row (per CLAUDE.md), drive the preview, then delete them.

**Files:** none (verification only).

- [ ] **Step 1: Start preview + create temp users**

Start the dev server (`preview_start`). For each of `office`, `factory`, `site`, create an auth user (`email_confirm:true`) and upsert a `profiles` row with that role (service-role key from `.env.local`). Record their ids for cleanup.

- [ ] **Step 2: Office user**

Log in as the office user. Verify:
- Lands on `/dashboard` (Office view).
- The Office ⇄ Production switch is visible.
- Can open `/production/settings/materials` (Production settings reachable).
Expected: all true; no console errors.

- [ ] **Step 3: Factory user**

Log in as the factory user. Verify:
- Navigating to `/dashboard` redirects to `/production` (no Office view).
- The Office ⇄ Production switch is NOT shown.
- `/production/settings/materials` redirects to `/production` (no production settings).
Expected: all true.

- [ ] **Step 4: Site user**

Log in as the site user. Verify:
- `/dashboard` redirects to `/production`.
- Production area shows the installation section only.
Expected: all true.

- [ ] **Step 5: Clean up temp users**

Delete the three temp auth users via the admin API (cascade removes their profiles). Verify the profiles are gone. Stop the preview server.

> Note: existing `member` users (josh, shandon) are NOT migrated during the build — migration 027 applies at deploy time. They stay `member` on the live DB until then, which is fine because the live site still runs the old code. Their migration is verified post-deploy (see Deployment coordination).

- [ ] **Step 6: Push branch**

```bash
git push -u origin claude/user-permissions
```

---

## Deployment coordination (do at merge time, in this order)

Because dev and production share one Supabase DB, the schema change and the code deploy must be sequenced so the live site never reads a missing column or writes an invalid role:

1. **Apply migration 027 first** (`supabase db push`) — safe for the still-deployed old code: it migrates `member → office` and tightens the constraint, but keeps the two columns. Verify:
   `supabase db query "select role, count(*) from public.profiles group by role" --linked` → only `admin/office/factory/site`.
2. **Merge + deploy this PR** (after PR #8) — the new code stops reading `office_access` / `production_access`.
3. **Drop the dead columns** with a follow-up migration once the deploy is live:
   ```sql
   alter table public.profiles drop column if exists office_access;
   alter table public.profiles drop column if exists production_access;
   ```
   (This can be folded into the Step 2 / DB-lock-down PR.)

---

## Self-Review

**Spec coverage (Step 1 portion of the spec):**
- 4-role model, role decides all → Tasks 1–3. ✓
- Remove `member` + stop using `office_access`/`production_access` → Task 1 (DB: member→office + constraint), Task 2 (types), Tasks 3–5 (all references). Physical column drop deferred to post-deploy (Deployment coordination). ✓
- `member → office` migration → Task 1. ✓
- Office gets Production settings → Task 2 (`canSeeProductionSettings` = admin|office), Task 3 (layout `showProductionSettings`). ✓
- Factory/Site never see Office view → Task 3 (middleware redirect + `canSeeOffice`). ✓
- Team + Add-user become role-only with legend → Tasks 4–5. ✓
- Reference sweep matches the grep (`middleware`, both `layout`s, `production/settings/layout`, `types`, `access`, `team-list`, `team/page`, `create-user-form`, `api/users/create`). ✓

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `ProductionRole` is `admin|office|factory|site` everywhere; `canSeeOffice`/`canSeeProduction`/`canSeeProductionSettings` signatures `(role: string) => boolean` used consistently in middleware + layouts; `TeamMember` no longer carries the dropped fields, matching the `team/page.tsx` cast.

**Note:** Step 2 (DB write lock-down via RLS + status RPCs) is intentionally out of this plan and will be its own plan/PR.
