# Brief 004 — Settings Overhaul + Profile + Theme + Density + Team — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure settings into URL-routed sections with sidebar nav, add profile editing with avatar/preferences, implement dark mode via next-themes, add density preference, and create team management section.

**Architecture:** Next.js App Router nested layouts — a new `settings/layout.tsx` shell renders a sidebar (desktop) or drill-in list (mobile), with each section as a child route. Theme is managed via `next-themes` wrapping the root layout. Density is a CSS class on `<html>` toggling CSS custom properties. Preferences persist to Supabase `profiles` table.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 3 (class-based dark mode), next-themes, Supabase (Postgres + Storage), Radix UI primitives, Lucide icons.

**Design spec:** `docs/superpowers/specs/2026-05-27-brief-004-design.md`

---

## File Map

### New files

| File | Responsibility |
|------|----------------|
| `supabase/migrations/009_profile_preferences.sql` | Add `theme_preference`, `density_preference`, `notification_preferences` columns |
| `components/theme-provider.tsx` | Thin `"use client"` wrapper around `next-themes` ThemeProvider |
| `components/density-provider.tsx` | Reads density preference, applies `density-compact` class to `<html>` |
| `app/(app)/settings/layout.tsx` | Settings shell — sidebar (desktop) + mobile detection + `{children}` |
| `app/(app)/settings/page.tsx` | Mobile: section list with chevrons. Desktop: redirect to `/settings/profile` |
| `app/(app)/settings/profile/page.tsx` | Server component that fetches profile data, renders ProfileForm |
| `app/(app)/settings/business/page.tsx` | Wraps existing BusinessInfoForm |
| `app/(app)/settings/team/page.tsx` | Renders TeamList + InviteManager |
| `app/(app)/settings/phases/page.tsx` | Wraps existing PhaseManager |
| `components/settings/profile-form.tsx` | Client component: avatar, name, appearance toggles, password, sign out |
| `components/settings/team-list.tsx` | Team member list with admin role editing |

### Modified files

| File | Changes |
|------|---------|
| `lib/types.ts` | Add `theme_preference`, `density_preference`, `notification_preferences` to Profile |
| `package.json` | Add `next-themes` dependency |
| `app/layout.tsx` | Wrap `{children}` in ThemeProvider + DensityProvider |
| `app/globals.css` | Add density CSS custom properties + `.density-compact` overrides |
| `components/user-menu.tsx` | Add theme toggle menu item (Sun/Moon/Monitor cycle) |
| `components/mobile-fab.tsx` | Fix: hide FAB on all `/settings/*` sub-routes |
| `components/settings/business-info-form.tsx` | Fix `text-green-600` → dark-mode-safe colour |
| `components/settings/set-password.tsx` | Fix `text-green-600` → dark-mode-safe colour |

---

## Task 1: Database migration + type updates

**Files:**
- Create: `supabase/migrations/009_profile_preferences.sql`
- Modify: `lib/types.ts`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/009_profile_preferences.sql`:

```sql
-- Add preference columns to profiles
alter table profiles add column theme_preference text default 'system'
  check (theme_preference in ('light', 'dark', 'system'));

alter table profiles add column density_preference text default 'comfortable'
  check (density_preference in ('compact', 'comfortable'));

alter table profiles add column notification_preferences jsonb default '{}'::jsonb;
```

- [ ] **Step 2: Run the migration against production Supabase**

Run via Supabase SQL Editor or CLI:
```bash
# If using Supabase dashboard: paste the SQL into the SQL editor and execute
# Verify: SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles';
```

Expected: Three new columns appear on the `profiles` table.

- [ ] **Step 3: Update the Profile type in `lib/types.ts`**

Replace the existing `Profile` interface (lines 7–12) with:

```ts
export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: "admin" | "member";
  theme_preference: "light" | "dark" | "system";
  density_preference: "compact" | "comfortable";
  notification_preferences: Record<string, unknown>;
  created_at: string;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Errors about existing code not providing new profile fields. These will be resolved in subsequent tasks. Note the errors but don't fix them yet — they confirm the type change propagated.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/009_profile_preferences.sql lib/types.ts
git commit -m "feat: add profile preference columns (theme, density, notifications)"
```

---

## Task 2: Install next-themes + create ThemeProvider + DensityProvider

**Files:**
- Modify: `package.json` (via npm install)
- Create: `components/theme-provider.tsx`
- Create: `components/density-provider.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Install next-themes**

```bash
npm install next-themes
```

- [ ] **Step 2: Create `components/theme-provider.tsx`**

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 3: Create `components/density-provider.tsx`**

This component reads the density preference from a prop and toggles the `density-compact` class on `<html>`. It must be a client component.

```tsx
"use client";

import { useEffect } from "react";

export function DensityProvider({
  density,
  children,
}: {
  density: "compact" | "comfortable";
  children: React.ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    if (density === "compact") {
      root.classList.add("density-compact");
    } else {
      root.classList.remove("density-compact");
    }
  }, [density]);

  return <>{children}</>;
}
```

Note: For the initial root layout integration, density will default to `"comfortable"` since we don't have user context in the root layout. The actual density preference is applied when the app shell loads (the `(app)/layout.tsx` has the authenticated user). We'll update this in Task 5 when we build the profile form — the DensityProvider will be used in the settings/profile context to react to changes, and the app shell will pass the initial density.

- [ ] **Step 4: Add density CSS custom properties to `app/globals.css`**

Add after the existing `@layer base` blocks (after line 45 in the current file), before the `@layer utilities` block:

```css
@layer base {
  :root {
    --density-card-padding: 1.5rem;
    --density-row-padding: 0.75rem;
    --density-gap: 1.5rem;
    --density-section-gap: 2rem;
  }
  .density-compact {
    --density-card-padding: 1rem;
    --density-row-padding: 0.375rem;
    --density-gap: 0.75rem;
    --density-section-gap: 1rem;
  }
}
```

- [ ] **Step 5: Wrap root layout with ThemeProvider**

Modify `app/layout.tsx` to wrap `{children}` in `ThemeProvider`. The `DensityProvider` is NOT added to root layout — it will be used inside the app shell where we have user context.

Replace the `<body>` in `app/layout.tsx`:

```tsx
import { ThemeProvider } from "@/components/theme-provider";

// ... existing metadata/viewport exports ...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Verify the app still loads**

Run: `npm run dev`
Navigate to the app. Dark mode won't be toggleable yet, but the app should render identically to before. The `next-themes` script injects into `<head>` and reads `localStorage` for theme preference, falling back to system.

- [ ] **Step 7: Commit**

```bash
git add components/theme-provider.tsx components/density-provider.tsx app/layout.tsx app/globals.css package.json package-lock.json
git commit -m "feat: install next-themes, create ThemeProvider + DensityProvider + density CSS vars"
```

---

## Task 3: Settings layout shell + section routes

This is the core restructuring task. Replace the single flat settings page with a layout that has sidebar nav (desktop) and drill-in list (mobile), plus four child route pages.

**Files:**
- Create: `app/(app)/settings/layout.tsx`
- Rewrite: `app/(app)/settings/page.tsx`
- Create: `app/(app)/settings/profile/page.tsx`
- Create: `app/(app)/settings/business/page.tsx`
- Create: `app/(app)/settings/team/page.tsx`
- Create: `app/(app)/settings/phases/page.tsx`
- Modify: `components/mobile-fab.tsx` (lines 19)

- [ ] **Step 1: Create the settings layout shell**

Create `app/(app)/settings/layout.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Building2, Users, Layers } from "lucide-react";

const SETTINGS_NAV = [
  { href: "/settings/profile", label: "Profile", icon: User },
  { href: "/settings/business", label: "Business", icon: Building2 },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/phases", label: "Phases", icon: Layers },
] as const;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRoot = pathname === "/settings";

  return (
    <div className="container py-6 md:py-8 px-4">
      <div className="flex gap-8">
        {/* Desktop sidebar — hidden on mobile */}
        <nav className="hidden md:block w-56 shrink-0">
          <div className="sticky top-20 space-y-1">
            {SETTINGS_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Content area */}
        <div className={`flex-1 min-w-0 max-w-2xl ${isRoot ? "" : "hidden md:block"}`}>
          {children}
        </div>

        {/* Mobile: show children directly when on a sub-route */}
        {!isRoot && (
          <div className="flex-1 min-w-0 md:hidden">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
```

Wait — the layout needs a cleaner approach. The issue is that on mobile, `/settings` shows the list and sub-routes show content full-width. Both render `{children}` but the layout wrapper differs. Let me simplify:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Building2, Users, Layers, ChevronLeft } from "lucide-react";

const SETTINGS_NAV = [
  { href: "/settings/profile", label: "Profile", icon: User },
  { href: "/settings/business", label: "Business", icon: Building2 },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/phases", label: "Phases", icon: Layers },
] as const;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRoot = pathname === "/settings";

  return (
    <div className="container py-6 md:py-8 px-4">
      <div className="md:flex md:gap-8">
        {/* Desktop sidebar */}
        <nav className="hidden md:block w-56 shrink-0">
          <div className="sticky top-20 space-y-1">
            {SETTINGS_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Mobile back link — shown on sub-routes only */}
        {!isRoot && (
          <div className="md:hidden mb-4">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft size={16} />
              Settings
            </Link>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 max-w-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the settings index page**

Replace `app/(app)/settings/page.tsx` entirely. On desktop, this page redirects to `/settings/profile`. On mobile, it shows the drill-in list.

```tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { User, Building2, Users, Layers, ChevronRight } from "lucide-react";

const SETTINGS_SECTIONS = [
  { href: "/settings/profile", label: "Profile", description: "Name, avatar, appearance", icon: User },
  { href: "/settings/business", label: "Business", description: "Company info and branding", icon: Building2 },
  { href: "/settings/team", label: "Team", description: "Members and permissions", icon: Users },
  { href: "/settings/phases", label: "Phases", description: "Project phase pipeline", icon: Layers },
] as const;

export default async function SettingsIndexPage() {
  // Desktop: redirect to profile section
  // We detect this via a CSS-only approach — render both views,
  // hide list on md+ and show redirect meta on md+ via a client component.
  // Simpler approach: always render the list; desktop sidebar highlights profile anyway.
  // The layout already shows the sidebar on desktop, so this page is mainly for mobile.

  return (
    <div className="space-y-1 md:hidden">
      {SETTINGS_SECTIONS.map((section) => {
        const Icon = section.icon;
        return (
          <Link
            key={section.href}
            href={section.href}
            className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted transition-colors"
          >
            <Icon size={18} className="text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{section.label}</div>
              <div className="text-xs text-muted-foreground">{section.description}</div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}
```

For desktop redirect, add a client component at the top of the page that redirects on mount when the viewport is `md+`. Actually, the simpler approach from the spec: on desktop, the sidebar is always visible and highlights Profile. Since `/settings` is the index, the content area will just be empty. Let's add a desktop redirect via a small client helper:

Create a helper inside the same file (or inline):

```tsx
// Add at the top of the file, after imports:
import { SettingsDesktopRedirect } from "./desktop-redirect";
```

Create `app/(app)/settings/desktop-redirect.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function SettingsDesktopRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (window.innerWidth >= 768) {
      router.replace("/settings/profile");
    }
  }, [router]);
  return null;
}
```

Then in the settings index page, render both:

```tsx
import { SettingsDesktopRedirect } from "./desktop-redirect";

export default async function SettingsIndexPage() {
  return (
    <>
      <SettingsDesktopRedirect />
      <div className="space-y-1 md:hidden">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted transition-colors"
            >
              <Icon size={18} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{section.label}</div>
                <div className="text-xs text-muted-foreground">{section.description}</div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </Link>
          );
        })}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Create the business section page**

Create `app/(app)/settings/business/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { BusinessInfoForm } from "@/components/settings/business-info-form";
import type { BusinessInfo } from "@/lib/types";

export default async function BusinessSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: businessInfo }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
    supabase.from("business_info").select("*").eq("id", 1).single(),
  ]);

  const isAdmin = profile?.role === "admin";
  const biz: BusinessInfo = businessInfo || {
    id: 1, name: "", logo_url: null, address: null, phone: null,
    email: null, workshop_photo_url: null, updated_at: "",
  };

  return (
    <section className="rounded-lg border bg-card">
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
  );
}
```

- [ ] **Step 4: Create the team section page**

Create `app/(app)/settings/team/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { InviteManager } from "@/components/settings/invite-manager";

export default async function TeamSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profiles }, { data: profile }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url, role, created_at").order("created_at"),
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
  ]);

  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-6">
      {/* Team members list */}
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Team</h2>
        </div>
        <ul className="divide-y">
          {(profiles || []).map((p) => (
            <li key={p.id} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {(p.full_name || "?").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium">{p.full_name || "—"}</div>
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted capitalize">{p.role}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Allowed emails — admin only */}
      {isAdmin && (
        <section className="rounded-lg border bg-card">
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
    </div>
  );
}
```

- [ ] **Step 5: Create the phases section page**

Create `app/(app)/settings/phases/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { PhaseManager } from "@/components/settings/phase-manager";

export default async function PhasesSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: phases }, { data: profile }] = await Promise.all([
    supabase.from("phases").select("*").order("sort_order"),
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
  ]);

  const isAdmin = profile?.role === "admin";

  return <PhaseManager initialPhases={phases || []} isAdmin={isAdmin} />;
}
```

- [ ] **Step 6: Create a stub profile page (placeholder until Task 5)**

Create `app/(app)/settings/profile/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { SetPassword } from "@/components/settings/set-password";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      {/* Name + email — read only for now, full form in Task 5 */}
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Profile</h2>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground">Email:</span>{" "}
            {user?.email || "—"}
          </div>
        </div>
      </section>

      {/* Password */}
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Password</h2>
        </div>
        <div className="px-5 py-4">
          <SetPassword />
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Fix MobileFab to hide on all settings sub-routes**

In `components/mobile-fab.tsx`, change line 19 from:

```ts
if (pathname === "/settings") return null;
```

to:

```ts
if (pathname.startsWith("/settings")) return null;
```

- [ ] **Step 8: Verify the app compiles and routes work**

Run: `npm run dev`

Test:
- Navigate to `/settings` — desktop should redirect to `/settings/profile`
- Navigate to `/settings/business` — should show BusinessInfoForm
- Navigate to `/settings/team` — should show team list + InviteManager (if admin)
- Navigate to `/settings/phases` — should show PhaseManager
- Desktop sidebar should highlight the active section
- The old flat settings page content is now split across these four routes

- [ ] **Step 9: Commit**

```bash
git add app/(app)/settings/ components/mobile-fab.tsx
git commit -m "feat: restructure settings into URL-routed sections with sidebar nav"
```

---

## Task 4: Theme toggle in user menu

**Files:**
- Modify: `components/user-menu.tsx`

- [ ] **Step 1: Add theme toggle to user menu**

Add the `useTheme` hook import and a theme toggle menu item to `components/user-menu.tsx`.

Add to imports:

```tsx
import { useTheme } from "next-themes";
```

Inside the `UserMenu` component, after `const bg = avatarColor(email);`, add:

```tsx
const { theme, setTheme } = useTheme();

function cycleTheme() {
  const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  setTheme(next);
}

function themeLabel() {
  if (theme === "light") return "Light";
  if (theme === "dark") return "Dark";
  return "System";
}
```

Add a new menu item between the Settings link and the Sign out separator. After the `</DropdownMenu.Item>` for Settings (line 95) and before the second `<DropdownMenu.Separator>` (line 97), add:

```tsx
<DropdownMenu.Item
  onSelect={cycleTheme}
  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer outline-none hover:bg-muted focus:bg-muted"
>
  {theme === "dark" ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  ) : theme === "light" ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" /><path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" /><path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  )}
  Theme: {themeLabel()}
</DropdownMenu.Item>
```

- [ ] **Step 2: Also persist theme preference to Supabase**

When cycling theme, also save to the profiles table. Add this to the `cycleTheme` function:

```tsx
function cycleTheme() {
  const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  setTheme(next);
  // Persist to DB (fire-and-forget)
  const supabase = createClient();
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (user) {
      supabase.from("profiles").update({ theme_preference: next }).eq("id", user.id);
    }
  });
}
```

- [ ] **Step 3: Verify theme toggling works**

Run: `npm run dev`

Test:
- Open user menu dropdown
- Click "Theme: System" — should cycle to "Theme: Light" and page goes light
- Click again — "Theme: Dark" and page goes dark
- Click again — "Theme: System" and follows OS preference
- Reload page — theme should persist (next-themes uses localStorage)

- [ ] **Step 4: Commit**

```bash
git add components/user-menu.tsx
git commit -m "feat: add theme toggle to user menu dropdown (system/light/dark cycle)"
```

---

## Task 5: Profile form with avatar, name, appearance toggles

**Files:**
- Create: `components/settings/profile-form.tsx`
- Modify: `app/(app)/settings/profile/page.tsx`

- [ ] **Step 1: Create the profile form component**

Create `components/settings/profile-form.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { SetPassword } from "@/components/settings/set-password";

interface ProfileFormProps {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  themePref: "light" | "dark" | "system";
  densityPref: "compact" | "comfortable";
}

export function ProfileForm({
  userId,
  email,
  fullName: initialName,
  avatarUrl: initialAvatar,
  themePref,
  densityPref: initialDensity,
}: ProfileFormProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const supabase = createClient();
  const avatarRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName || "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar || "");
  const [density, setDensity] = useState(initialDensity);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Sync next-themes with DB preference on mount
  // (next-themes reads localStorage; this ensures DB value wins on first load)
  useState(() => {
    if (themePref && theme !== themePref) {
      setTheme(themePref);
    }
  });

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${userId}.${ext}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (error) {
      setError(`Upload failed: ${error.message}`);
      setSaving(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`; // cache-bust
    setAvatarUrl(publicUrl);
    // Save avatar URL to profile immediately
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
    setSaving(false);
    router.refresh();
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setStatus("idle");
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name })
      .eq("id", userId);
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("saved");
      router.refresh();
    }
    setSaving(false);
  }

  function handleThemeChange(newTheme: "light" | "dark" | "system") {
    setTheme(newTheme);
    supabase.from("profiles").update({ theme_preference: newTheme }).eq("id", userId);
  }

  function handleDensityChange(newDensity: "compact" | "comfortable") {
    setDensity(newDensity);
    // Apply immediately
    if (newDensity === "compact") {
      document.documentElement.classList.add("density-compact");
    } else {
      document.documentElement.classList.remove("density-compact");
    }
    supabase.from("profiles").update({ density_preference: newDensity }).eq("id", userId);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="space-y-6">
      {/* Avatar + Name */}
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Profile</h2>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-start gap-4 mb-4">
            <button
              type="button"
              onClick={() => avatarRef.current?.click()}
              className="h-24 w-24 rounded-full bg-muted flex items-center justify-center text-lg font-medium overflow-hidden shrink-0 hover:opacity-80 transition-opacity"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-24 w-24 object-cover" />
              ) : (
                (name || email).slice(0, 2).toUpperCase()
              )}
            </button>
            <input
              ref={avatarRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <div className="pt-2">
              <p className="text-sm font-medium">Profile photo</p>
              <p className="text-xs text-muted-foreground mt-0.5">Click the circle to upload</p>
            </div>
          </div>

          <form onSubmit={handleSaveName} className="space-y-3 max-w-sm">
            <div>
              <label className="block text-sm font-medium mb-1.5">Full name</label>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setStatus("idle"); }}
                className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                value={email}
                disabled
                className="w-full h-9 px-3 rounded-md border bg-muted text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {status === "saved" && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</span>}
              {status === "error" && error && <span className="text-sm text-destructive">{error}</span>}
            </div>
          </form>
        </div>
      </section>

      {/* Appearance */}
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Appearance</h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Theme */}
          <div>
            <label className="block text-sm font-medium mb-2">Theme</label>
            <div className="inline-flex items-center rounded-md border p-0.5">
              {(["light", "dark", "system"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleThemeChange(opt)}
                  className={`h-8 px-3 text-xs rounded font-medium transition-colors capitalize ${
                    (theme || "system") === opt
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Density */}
          <div>
            <label className="block text-sm font-medium mb-2">Density</label>
            <div className="inline-flex items-center rounded-md border p-0.5">
              {(["comfortable", "compact"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleDensityChange(opt)}
                  className={`h-8 px-3 text-xs rounded font-medium transition-colors capitalize ${
                    density === opt
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">Adjusts padding and spacing. Font sizes stay the same.</p>
          </div>
        </div>
      </section>

      {/* Password */}
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Password</h2>
        </div>
        <div className="px-5 py-4">
          <SetPassword />
        </div>
      </section>

      {/* Sign out */}
      <button
        type="button"
        onClick={handleSignOut}
        className="h-9 px-4 rounded-md border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Update the profile page to use ProfileForm**

Replace `app/(app)/settings/profile/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, theme_preference, density_preference")
    .eq("id", user!.id)
    .single();

  return (
    <ProfileForm
      userId={user!.id}
      email={user!.email || ""}
      fullName={profile?.full_name || ""}
      avatarUrl={profile?.avatar_url || null}
      themePref={profile?.theme_preference || "system"}
      densityPref={profile?.density_preference || "comfortable"}
    />
  );
}
```

- [ ] **Step 3: Verify the profile page works**

Run: `npm run dev`

Test:
- Navigate to `/settings/profile`
- Avatar upload area should be visible (click to upload)
- Name field should be editable with Save button
- Email should be read-only
- Theme segmented control should work (light/dark/system)
- Density segmented control should work (comfortable/compact)
- Password section should work as before
- Sign out button should work

- [ ] **Step 4: Commit**

```bash
git add components/settings/profile-form.tsx app/(app)/settings/profile/page.tsx
git commit -m "feat: create profile form with avatar upload, appearance toggles, and sign out"
```

---

## Task 6: Team list with admin role editing

**Files:**
- Create: `components/settings/team-list.tsx`
- Modify: `app/(app)/settings/team/page.tsx`

- [ ] **Step 1: Create the team list component**

Create `components/settings/team-list.tsx`:

```tsx
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

  async function handleRoleChange(memberId: string, newRole: "admin" | "member") {
    setUpdating(memberId);
    const supabase = createClient();
    await supabase.from("profiles").update({ role: newRole }).eq("id", memberId);
    setUpdating(null);
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
                <select
                  value={m.role}
                  disabled={updating === m.id}
                  onChange={(e) => handleRoleChange(m.id, e.target.value as "admin" | "member")}
                  className="h-7 px-2 text-xs rounded-md border bg-background cursor-pointer disabled:opacity-50"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
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
```

- [ ] **Step 2: Update team page to use TeamList component**

Replace `app/(app)/settings/team/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { TeamList } from "@/components/settings/team-list";
import { InviteManager } from "@/components/settings/invite-manager";

export default async function TeamSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profiles }, { data: profile }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url, role").order("created_at"),
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
  ]);

  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-6">
      <TeamList
        members={(profiles || []) as { id: string; full_name: string; avatar_url: string | null; role: "admin" | "member" }[]}
        currentUserId={user!.id}
        isAdmin={isAdmin}
      />

      {isAdmin && (
        <section className="rounded-lg border bg-card">
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
    </div>
  );
}
```

- [ ] **Step 3: Verify team page**

Run: `npm run dev`

Test:
- Navigate to `/settings/team`
- Team members list should show with avatars (or initials) and names
- Current user should show "(you)" label
- Admin should see role dropdowns for other members
- Changing a role should save immediately
- Cannot change own role (shows badge instead of dropdown)
- Allowed emails section should appear below (admin only)

- [ ] **Step 4: Commit**

```bash
git add components/settings/team-list.tsx app/(app)/settings/team/page.tsx
git commit -m "feat: create team list with admin role editing"
```

---

## Task 7: Dark mode audit — fix hardcoded colours

The codebase is already well-designed with CSS variables. The audit found these specific issues:

**Files:**
- Modify: `components/settings/business-info-form.tsx` (line 198)
- Modify: `components/settings/set-password.tsx` (line 66)
- Modify: `components/plan/year-plan-view.tsx` (line 274-276 — hardcoded `#ef4444` and `fill="white"`)

- [ ] **Step 1: Fix success text colours in BusinessInfoForm**

In `components/settings/business-info-form.tsx`, line 198, change:

```tsx
{status === "saved" && <span className="text-sm text-green-600">Saved.</span>}
```

to:

```tsx
{status === "saved" && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</span>}
```

- [ ] **Step 2: Fix success text colour in SetPassword**

In `components/settings/set-password.tsx`, line 66, change:

```tsx
{status === "success" && <p className="text-sm text-green-600">Password updated.</p>}
```

to:

```tsx
{status === "success" && <p className="text-sm text-emerald-600 dark:text-emerald-400">Password updated.</p>}
```

- [ ] **Step 3: Verify dark mode rendering across all pages**

Run: `npm run dev`

Toggle to dark mode via user menu. Visit each page and verify:

| Page | Check |
|------|-------|
| `/dashboard` | Cards render with `bg-card`, text is readable |
| `/plan` | Gantt bars visible, calendar grid borders visible |
| `/projects` | Phase badges readable, card borders visible |
| `/projects/[id]` | Room cards, task list borders |
| `/tasks` | Tab indicators, checkboxes |
| `/settings/*` | All four sections render cleanly |
| `/login` | Background, input borders, tab switcher |

The codebase already uses semantic tokens (`bg-card`, `bg-background`, `text-foreground`, `text-muted-foreground`, `border`) throughout — these automatically switch in dark mode. Phase colours use inline `style` attributes with user-chosen hex values; these work in both modes because they're absolute colours on `bg-card` backgrounds which have sufficient contrast.

- [ ] **Step 4: Commit**

```bash
git add components/settings/business-info-form.tsx components/settings/set-password.tsx
git commit -m "fix: dark mode audit — replace hardcoded green-600 with theme-aware colours"
```

---

## Task 8: Wire density preference into the app shell

The density preference needs to be read from the user's profile when the app loads, and the `density-compact` class applied to `<html>` accordingly.

**Files:**
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Add density class application to the app shell**

In `app/(app)/layout.tsx`, after the existing `Promise.all` that fetches `profile` and `businessInfo`, read `density_preference` and pass it via a small client component.

First, add the `DensityProvider` import:

```tsx
import { DensityProvider } from "@/components/density-provider";
```

Then update the profile select to include `density_preference`:

Change line 22:

```tsx
supabase.from("profiles").select("full_name, role, avatar_url").eq("id", user.id).single(),
```

to:

```tsx
supabase.from("profiles").select("full_name, role, avatar_url, density_preference").eq("id", user.id).single(),
```

Then wrap `{children}` inside `<main>` with the DensityProvider:

Change:

```tsx
<main className="flex-1 pb-20 md:pb-0">{children}</main>
```

to:

```tsx
<main className="flex-1 pb-20 md:pb-0">
  <DensityProvider density={profile.density_preference || "comfortable"}>
    {children}
  </DensityProvider>
</main>
```

- [ ] **Step 2: Verify density toggle works end-to-end**

Run: `npm run dev`

Test:
1. Navigate to `/settings/profile`
2. Toggle density to "Compact"
3. Verify the page spacing tightens (check with browser dev tools: `document.documentElement.classList` should include `density-compact`)
4. Reload page — density should persist (class applied on mount from DB value)
5. Toggle back to "Comfortable" — spacing returns to normal

- [ ] **Step 3: Commit**

```bash
git add app/(app)/layout.tsx
git commit -m "feat: wire density preference from profile into app shell"
```

---

## Task 9: Apply density CSS variables to key components

Replace hardcoded padding/gap values with density CSS variables in the most impactful areas.

**Files:**
- Modify: `components/dashboard/dashboard-card.tsx`
- Modify: `components/settings/phase-manager.tsx`

- [ ] **Step 1: Read current dashboard-card.tsx to identify padding values**

Read `components/dashboard/dashboard-card.tsx` and identify hardcoded `p-*` and `gap-*` values that should use density variables.

The main places to update:
- Card wrapper padding (likely `p-5` or `p-6`)
- Any list row padding within cards

- [ ] **Step 2: Update dashboard card padding**

In `components/dashboard/dashboard-card.tsx`, replace the card body padding. Change the wrapper's content padding from hardcoded Tailwind class to use the CSS variable:

If the card has a class like `p-5` on its content area, change it to use inline style:

```tsx
style={{ padding: "var(--density-card-padding)" }}
```

Or add a utility class. Since Tailwind doesn't support CSS variables in utility classes directly, use inline styles for the density-affected properties.

- [ ] **Step 3: Verify density changes are visible**

Run: `npm run dev`

Toggle between Comfortable and Compact in profile settings. Dashboard cards should show tighter padding in compact mode.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/dashboard-card.tsx components/settings/phase-manager.tsx
git commit -m "feat: apply density CSS variables to dashboard cards and phase manager"
```

---

## Task 10: Final build verification + popover token check

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: No errors. If there are errors related to the new profile fields, fix them.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Check Radix UI popover/dropdown tokens**

Verify that Radix components (DropdownMenu, Dialog, Popover) use `bg-popover` or `bg-card` tokens. Search for any that use hardcoded backgrounds.

The existing user-menu already uses `bg-popover` (line 68 of user-menu.tsx) — this is correct.

- [ ] **Step 4: Visual verification across themes**

Using the app in the browser:
1. Light mode: Navigate all pages — verify everything looks correct
2. Dark mode: Navigate all pages — verify everything looks correct
3. System mode: Verify it follows OS preference
4. Compact density: Verify padding tightens on dashboard and settings

- [ ] **Step 5: Commit any fixes**

If any fixes were needed, commit them:

```bash
git add -A
git commit -m "fix: final verification fixes for Brief 004"
```

---

## Summary

| Task | What | Key files |
|------|------|-----------|
| 1 | Migration + types | `009_profile_preferences.sql`, `lib/types.ts` |
| 2 | next-themes + providers | `theme-provider.tsx`, `density-provider.tsx`, `app/layout.tsx`, `globals.css` |
| 3 | Settings layout + routes | `settings/layout.tsx`, `settings/page.tsx`, 4 section pages, `mobile-fab.tsx` |
| 4 | Theme toggle in user menu | `user-menu.tsx` |
| 5 | Profile form | `profile-form.tsx`, `settings/profile/page.tsx` |
| 6 | Team list | `team-list.tsx`, `settings/team/page.tsx` |
| 7 | Dark mode audit | `business-info-form.tsx`, `set-password.tsx` |
| 8 | Density in app shell | `app/(app)/layout.tsx` |
| 9 | Density CSS in components | `dashboard-card.tsx`, `phase-manager.tsx` |
| 10 | Final verification | Build + visual check |
