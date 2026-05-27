# Brief 002 — Header, Mobile Tabs, Dashboard Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the header to show business name + page title inline, enlarge mobile bottom tabs with pill active state, and build a customisable dashboard card system with localStorage persistence.

**Architecture:** Server layout renders header chrome with a client `PageTitle` component that reads the current route. Dashboard becomes a client `DashboardGrid` that reads card layout from localStorage, renders cards via lazy-loaded registry, and supports edit mode (add/remove/reorder via @dnd-kit). No schema migrations — localStorage only.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, @dnd-kit/core + @dnd-kit/sortable, Radix Dialog, Supabase client SDK, localStorage.

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `components/page-title.tsx` | Client component — maps `usePathname()` to page title string |
| `lib/dashboard/card-registry.ts` | Card type definitions + lazy import registry |
| `lib/dashboard/dashboard-layout.ts` | localStorage read/write for per-user card layouts |
| `components/dashboard/dashboard-card.tsx` | Base card wrapper (border, header, edit-mode controls) |
| `components/dashboard/dashboard-grid.tsx` | Grid container, edit mode toggle, drag-and-drop, Suspense |
| `components/dashboard/add-card-dialog.tsx` | Radix Dialog listing available cards to add |
| `components/dashboard/card-skeleton.tsx` | Pulse skeleton used as Suspense fallback |
| `components/dashboard/cards/my-tasks-card.tsx` | My open tasks list |
| `components/dashboard/cards/upcoming-deadlines-card.tsx` | Projects due within 14 days |
| `components/dashboard/cards/projects-by-phase-card.tsx` | Project counts grouped by phase |
| `components/dashboard/cards/team-workload-card.tsx` | Open tasks per team member |
| `components/dashboard/cards/personal-todos-card.tsx` | Personal tasks with toggle-complete |
| `components/dashboard/cards/notes-card.tsx` | localStorage-only scratch notepad |

### Modified files

| File | What changes |
|------|-------------|
| `app/(app)/layout.tsx` | Header restructure (PageTitle, separator), main padding `pb-16` to `pb-20` |
| `components/bottom-tab-bar.tsx` | Height 72px, icons 24px, labels 11px, pill active state, iOS safe area |
| `app/(app)/dashboard/page.tsx` | Remove heading block, pass userId to DashboardGrid |
| `app/(app)/settings/page.tsx` | Remove `<h1>` heading block |
| `app/(app)/projects/page.tsx` | Remove `<h1>` heading block (keep New project button) |
| `components/tasks/tasks-client.tsx` | Remove `<h1>` heading block (keep + Add task button) |
| `components/plan/year-plan-view.tsx` | Remove `<h1>` heading block |
| `package.json` | Add @dnd-kit/core, @dnd-kit/sortable |

---

## Task 1: Create PageTitle component

**Files:**
- Create: `components/page-title.tsx`

- [ ] **Step 1: Create the PageTitle client component**

Create `components/page-title.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/plan": "Year Plan",
  "/projects": "Projects",
  "/projects/new": "New Project",
  "/tasks": "Tasks",
  "/settings": "Settings",
};

export function PageTitle() {
  const pathname = usePathname();

  let title = ROUTE_TITLES[pathname];
  if (!title) {
    if (pathname.startsWith("/projects/")) title = "Project";
    else title = "";
  }

  if (!title) return null;

  return (
    <span className="text-sm font-medium text-foreground truncate">
      {title}
    </span>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `page-title.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/page-title.tsx
git commit -m "feat: add PageTitle component mapping routes to display titles"
```

---

## Task 2: Restructure the header in AppShell layout

**Files:**
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Update the header in layout.tsx**

Replace the entire contents of `app/(app)/layout.tsx`:

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserMenu } from "@/components/user-menu";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { PageTitle } from "@/components/page-title";

const NAV = [
  { href: "/dashboard" as const, label: "Dashboard" },
  { href: "/plan" as const, label: "Year plan" },
  { href: "/projects" as const, label: "Projects" },
  { href: "/tasks" as const, label: "Tasks" },
];

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: businessInfo }] = await Promise.all([
    supabase.from("profiles").select("full_name, role, avatar_url").eq("id", user.id).single(),
    supabase.from("business_info").select("name, logo_url").eq("id", 1).single(),
  ]);

  if (!profile) {
    return (
      <main className="min-h-screen grid place-items-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold mb-2">Access denied</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Your email hasn&apos;t been approved for this workspace. Ask an admin to add you.
          </p>
          <form action="/auth/signout" method="POST">
            <button type="submit" className="text-sm underline text-muted-foreground hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  const bizName = businessInfo?.name || "Cabinet PM";
  const bizLogo = businessInfo?.logo_url || null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              {bizLogo && (
                <img src={bizLogo} alt="" className="h-7 w-7 object-contain rounded" />
              )}
              <span className="hidden md:inline text-sm font-semibold tracking-tight">{bizName}</span>
            </Link>
            <span className="hidden md:inline text-muted-foreground/40 text-sm">/</span>
            <PageTitle />
          </div>
          <div className="flex items-center gap-1 md:gap-4">
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <UserMenu
              fullName={profile.full_name}
              email={user.email || ""}
              role={profile.role}
              avatarUrl={profile.avatar_url || null}
            />
          </div>
        </div>
      </header>
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <BottomTabBar />
    </div>
  );
}
```

Key changes from original:
- Import and render `<PageTitle />` after biz name
- Add `/` separator (hidden on mobile via `hidden md:inline`)
- Biz name now `text-sm` with `shrink-0`
- Nav and avatar grouped together in a flex container
- Main padding changed from `pb-16` to `pb-20`

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Clean compilation

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/layout.tsx
git commit -m "feat: restructure header with inline business name, page title, and slash separator"
```

---

## Task 3: Remove heading blocks from all page bodies

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`
- Modify: `app/(app)/settings/page.tsx`
- Modify: `app/(app)/projects/page.tsx`
- Modify: `components/tasks/tasks-client.tsx`
- Modify: `components/plan/year-plan-view.tsx`

- [ ] **Step 1: Update dashboard page**

In `app/(app)/dashboard/page.tsx`, remove the heading block (the `<div className="mb-6">` containing business name/logo and `<h1>Dashboard</h1>`, lines 31-41). Also remove the `businessInfo` query from `Promise.all` and its destructuring since it's no longer needed.

The return becomes:

```tsx
  return (
    <div className="container py-6 md:py-8 px-4">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* ...existing card sections unchanged... */}
      </div>
    </div>
  );
```

- [ ] **Step 2: Update settings page**

In `app/(app)/settings/page.tsx`, remove line 26:

```tsx
      <h1 className="text-xl md:text-2xl font-semibold tracking-tight mb-6">Settings</h1>
```

- [ ] **Step 3: Update projects page**

In `app/(app)/projects/page.tsx`, replace the heading+button wrapper (lines 19-24):

Before:
```tsx
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Projects</h1>
        <Link ...>New project</Link>
      </div>
```

After:
```tsx
      <div className="flex justify-end mb-6">
        <Link
          href="/projects/new"
          className="h-9 px-4 inline-flex items-center rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >New project</Link>
      </div>
```

- [ ] **Step 4: Update tasks-client**

In `components/tasks/tasks-client.tsx`, replace the heading+button wrapper (lines 116-124):

Before:
```tsx
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Tasks</h1>
        <button ...>{showForm ? "Cancel" : "+ Add task"}</button>
      </div>
```

After:
```tsx
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
        >
          {showForm ? "Cancel" : "+ Add task"}
        </button>
      </div>
```

- [ ] **Step 5: Update year-plan-view**

In `components/plan/year-plan-view.tsx`, remove the `<h1>` line (line 38):

```tsx
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Year plan</h1>
```

The subtitle `<p>` with project count stays as-is.

- [ ] **Step 6: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Clean compilation

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/dashboard/page.tsx app/\(app\)/settings/page.tsx app/\(app\)/projects/page.tsx components/tasks/tasks-client.tsx components/plan/year-plan-view.tsx
git commit -m "refactor: remove page-body headings — titles now shown in header bar"
```

---

## Task 4: Bigger mobile bottom tabs with pill active state

**Files:**
- Modify: `components/bottom-tab-bar.tsx`

- [ ] **Step 1: Rewrite bottom-tab-bar.tsx**

Replace the full contents of `components/bottom-tab-bar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, FolderKanban, CheckSquare } from "lucide-react";

const TABS = [
  { href: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { href: "/plan?view=calendar" as const, label: "Year plan", icon: Calendar, matchPath: "/plan" },
  { href: "/projects" as const, label: "Projects", icon: FolderKanban },
  { href: "/tasks" as const, label: "Tasks", icon: CheckSquare },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-[72px]">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.matchPath || tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
            >
              <span
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <Icon size={24} strokeWidth={isActive ? 2.25 : 1.75} />
                <span className={`text-[11px] ${isActive ? "font-medium" : ""}`}>
                  {tab.label}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

Changes: `h-14` to `h-[72px]`, icons 20 to 24, labels 10px to 11px, pill active state with `bg-muted rounded-lg`, iOS safe area padding.

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Clean compilation

- [ ] **Step 3: Commit**

```bash
git add components/bottom-tab-bar.tsx
git commit -m "feat: enlarge mobile bottom tabs — 72px height, 24px icons, pill active state, iOS safe area"
```

---

## Task 5: Install @dnd-kit dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @dnd-kit**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

- [ ] **Step 2: Verify installation**

Run: `node -e "require('@dnd-kit/core'); require('@dnd-kit/sortable'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities for dashboard drag-and-drop"
```

---

## Task 6: Dashboard layout persistence (localStorage)

**Files:**
- Create: `lib/dashboard/dashboard-layout.ts`

- [ ] **Step 1: Create the layout persistence module**

Create `lib/dashboard/dashboard-layout.ts`:

```ts
export interface CardLayout {
  cardType: string;
  position: number;
}

const STORAGE_PREFIX = "cabinet-pm-dashboard-";

const DEFAULT_LAYOUT: CardLayout[] = [
  { cardType: "my_tasks", position: 0 },
  { cardType: "upcoming_deadlines", position: 1 },
  { cardType: "projects_by_phase", position: 2 },
];

export function getDefaultLayout(): CardLayout[] {
  return DEFAULT_LAYOUT.map((c) => ({ ...c }));
}

export function getLayout(userId: string): CardLayout[] {
  if (typeof window === "undefined") return getDefaultLayout();
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return getDefaultLayout();
    const parsed = JSON.parse(raw) as CardLayout[];
    if (!Array.isArray(parsed) || parsed.length === 0) return getDefaultLayout();
    return parsed.sort((a, b) => a.position - b.position);
  } catch {
    return getDefaultLayout();
  }
}

export function setLayout(userId: string, layout: CardLayout[]): void {
  if (typeof window === "undefined") return;
  const ordered = layout.map((c, i) => ({ cardType: c.cardType, position: i }));
  localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(ordered));
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Clean compilation

- [ ] **Step 3: Commit**

```bash
git add lib/dashboard/dashboard-layout.ts
git commit -m "feat: add localStorage persistence for per-user dashboard card layouts"
```

---

## Task 7: Card registry and types

**Files:**
- Create: `lib/dashboard/card-registry.ts`

- [ ] **Step 1: Create the card registry**

Create `lib/dashboard/card-registry.ts`:

```ts
import { lazy, type ComponentType } from "react";

export interface CardDefinition {
  type: string;
  title: string;
  description: string;
  component: React.LazyExoticComponent<ComponentType<CardProps>>;
  defaultSize: "sm" | "lg";
  actionLabel?: string;
  actionHref?: string;
}

export interface CardProps {
  userId: string;
}

export const CARD_REGISTRY: Record<string, CardDefinition> = {
  my_tasks: {
    type: "my_tasks",
    title: "My tasks",
    description: "Your open tasks sorted by due date",
    component: lazy(() => import("@/components/dashboard/cards/my-tasks-card")),
    defaultSize: "sm",
    actionLabel: "View all",
    actionHref: "/tasks",
  },
  upcoming_deadlines: {
    type: "upcoming_deadlines",
    title: "Upcoming deadlines",
    description: "Projects due within the next 14 days",
    component: lazy(() => import("@/components/dashboard/cards/upcoming-deadlines-card")),
    defaultSize: "sm",
    actionLabel: "View all",
    actionHref: "/projects",
  },
  projects_by_phase: {
    type: "projects_by_phase",
    title: "Projects by phase",
    description: "Project counts grouped by phase",
    component: lazy(() => import("@/components/dashboard/cards/projects-by-phase-card")),
    defaultSize: "sm",
  },
  team_workload: {
    type: "team_workload",
    title: "Team workload",
    description: "Open tasks per team member",
    component: lazy(() => import("@/components/dashboard/cards/team-workload-card")),
    defaultSize: "sm",
  },
  personal_todos: {
    type: "personal_todos",
    title: "Personal todos",
    description: "Your personal tasks not linked to any project",
    component: lazy(() => import("@/components/dashboard/cards/personal-todos-card")),
    defaultSize: "sm",
    actionLabel: "View all",
    actionHref: "/tasks?filter=personal",
  },
  notes: {
    type: "notes",
    title: "Notes",
    description: "Quick scratch notepad",
    component: lazy(() => import("@/components/dashboard/cards/notes-card")),
    defaultSize: "sm",
  },
};

export const ALL_CARD_TYPES = Object.keys(CARD_REGISTRY);
```

- [ ] **Step 2: Commit**

```bash
git add lib/dashboard/card-registry.ts
git commit -m "feat: add card registry with lazy-imported card definitions"
```

---

## Task 8: DashboardCard wrapper and CardSkeleton

**Files:**
- Create: `components/dashboard/dashboard-card.tsx`
- Create: `components/dashboard/card-skeleton.tsx`

- [ ] **Step 1: Create the card skeleton**

Create `components/dashboard/card-skeleton.tsx`:

```tsx
export function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card animate-pulse">
      <div className="px-5 py-3.5 border-b">
        <div className="h-4 w-24 bg-muted rounded" />
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-3/4 bg-muted rounded" />
        <div className="h-3 w-1/2 bg-muted rounded" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the DashboardCard wrapper**

Create `components/dashboard/dashboard-card.tsx`:

```tsx
"use client";

import Link from "next/link";
import { X } from "lucide-react";

interface Props {
  title: string;
  actionLabel?: string;
  actionHref?: string;
  isEditing?: boolean;
  onRemove?: () => void;
  children: React.ReactNode;
}

export function DashboardCard({ title, actionLabel, actionHref, isEditing, onRemove, children }: Props) {
  return (
    <section className="rounded-lg border bg-card relative">
      {isEditing && onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-2 -right-2 z-10 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:opacity-80"
          aria-label="Remove card"
        >
          <X size={14} />
        </button>
      )}
      <div className="px-5 py-3.5 border-b flex items-center justify-between">
        <h2 className="font-medium text-sm">{title}</h2>
        {actionLabel && actionHref && (
          <Link href={actionHref} className="text-xs text-muted-foreground hover:text-foreground">
            {actionLabel} &rarr;
          </Link>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Clean compilation

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/dashboard-card.tsx components/dashboard/card-skeleton.tsx
git commit -m "feat: add DashboardCard wrapper and CardSkeleton components"
```

---

## Task 9: AddCardDialog

**Files:**
- Create: `components/dashboard/add-card-dialog.tsx`

- [ ] **Step 1: Create the dialog**

Create `components/dashboard/add-card-dialog.tsx`:

```tsx
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus } from "lucide-react";
import { CARD_REGISTRY, ALL_CARD_TYPES } from "@/lib/dashboard/card-registry";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCardTypes: string[];
  onAdd: (cardType: string) => void;
}

export function AddCardDialog({ open, onOpenChange, activeCardTypes, onAdd }: Props) {
  const available = ALL_CARD_TYPES.filter((t) => !activeCardTypes.includes(t));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 animate-in fade-in-0" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-lg border bg-background p-5 shadow-lg animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold">Add card</Dialog.Title>
            <Dialog.Close className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted">
              <X size={16} />
            </Dialog.Close>
          </div>

          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">All cards are already on your dashboard.</p>
          ) : (
            <ul className="space-y-1">
              {available.map((type) => {
                const def = CARD_REGISTRY[type];
                return (
                  <li key={type}>
                    <button
                      onClick={() => onAdd(type)}
                      className="w-full text-left px-3 py-2.5 rounded-md hover:bg-muted transition-colors flex items-center gap-3"
                    >
                      <Plus size={16} className="text-muted-foreground shrink-0" />
                      <div>
                        <div className="text-sm font-medium">{def.title}</div>
                        <div className="text-xs text-muted-foreground">{def.description}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/add-card-dialog.tsx
git commit -m "feat: add AddCardDialog for picking new dashboard cards"
```

---

## Task 10: DashboardGrid with edit mode and drag-and-drop

**Files:**
- Create: `components/dashboard/dashboard-grid.tsx`

- [ ] **Step 1: Create the DashboardGrid component**

Create `components/dashboard/dashboard-grid.tsx`:

```tsx
"use client";

import { Suspense, useCallback, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Pencil } from "lucide-react";
import { CARD_REGISTRY, type CardProps } from "@/lib/dashboard/card-registry";
import { getLayout, setLayout, type CardLayout } from "@/lib/dashboard/dashboard-layout";
import { DashboardCard } from "./dashboard-card";
import { CardSkeleton } from "./card-skeleton";
import { AddCardDialog } from "./add-card-dialog";

function SortableCard({
  cardLayout,
  userId,
  isEditing,
  onRemove,
}: {
  cardLayout: CardLayout;
  userId: string;
  isEditing: boolean;
  onRemove: () => void;
}) {
  const definition = CARD_REGISTRY[cardLayout.cardType];
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cardLayout.cardType, disabled: !isEditing });

  if (!definition) return null;

  const LazyComponent = definition.component;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={definition.defaultSize === "lg" ? "lg:col-span-2" : ""}
    >
      <div className="relative">
        {isEditing && (
          <button
            {...attributes}
            {...listeners}
            className="absolute top-3 left-1.5 z-10 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
            aria-label="Drag to reorder"
          >
            <GripVertical size={16} />
          </button>
        )}
        <div className={isEditing ? "pl-6" : ""}>
          <Suspense fallback={<CardSkeleton />}>
            <DashboardCard
              title={definition.title}
              actionLabel={definition.actionLabel}
              actionHref={definition.actionHref}
              isEditing={isEditing}
              onRemove={onRemove}
            >
              <LazyComponent userId={userId} />
            </DashboardCard>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export function DashboardGrid({ userId }: { userId: string }) {
  const [cards, setCards] = useState<CardLayout[]>(() => getLayout(userId));
  const [isEditing, setIsEditing] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeCardTypes = cards.map((c) => c.cardType);

  const persist = useCallback(
    (next: CardLayout[]) => {
      setCards(next);
      setLayout(userId, next);
    },
    [userId]
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = cards.findIndex((c) => c.cardType === active.id);
    const newIndex = cards.findIndex((c) => c.cardType === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    persist(arrayMove(cards, oldIndex, newIndex));
  }

  function removeCard(cardType: string) {
    persist(cards.filter((c) => c.cardType !== cardType));
  }

  function addCard(cardType: string) {
    persist([...cards, { cardType, position: cards.length }]);
    setShowAddDialog(false);
  }

  return (
    <div className="container py-6 md:py-8 px-4">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="h-8 px-3 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 border hover:bg-muted"
        >
          <Pencil size={14} />
          {isEditing ? "Done" : "Customise"}
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeCardTypes} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {cards.map((card) => (
              <SortableCard
                key={card.cardType}
                cardLayout={card}
                userId={userId}
                isEditing={isEditing}
                onRemove={() => removeCard(card.cardType)}
              />
            ))}

            {isEditing && (
              <button
                onClick={() => setShowAddDialog(true)}
                className="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-transparent flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <Plus size={24} />
                <span className="text-sm font-medium">Add card</span>
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <AddCardDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        activeCardTypes={activeCardTypes}
        onAdd={addCard}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/dashboard-grid.tsx
git commit -m "feat: add DashboardGrid with edit mode, @dnd-kit drag-and-drop, and Suspense lazy loading"
```

---

## Task 11: My Tasks card

**Files:**
- Create: `components/dashboard/cards/my-tasks-card.tsx`

- [ ] **Step 1: Create the card component**

Create `components/dashboard/cards/my-tasks-card.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, isPast, isToday } from "date-fns";
import type { CardProps } from "@/lib/dashboard/card-registry";

interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  project_id: string | null;
  projects: { name: string } | null;
  rooms: { name: string } | null;
}

export default function MyTasksCard({ userId }: CardProps) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("tasks")
      .select("id, title, due_date, project_id, projects(name), rooms(name)")
      .eq("assigned_to", userId)
      .is("completed_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20)
      .then(({ data }) => {
        setTasks((data as TaskRow[]) || []);
        setLoading(false);
      });
  }, [userId]);

  return (
    <ul className="divide-y">
      {loading && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">Loading...</li>
      )}
      {!loading && tasks.length === 0 && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">No open tasks. Nice.</li>
      )}
      {tasks.map((t) => {
        const overdue = t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
        return (
          <li key={t.id} className="px-5 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{t.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t.projects?.name && <span>{t.projects.name}</span>}
                {t.rooms?.name && <span> &middot; {t.rooms.name}</span>}
                {!t.projects && !t.rooms && <span>Personal</span>}
              </div>
            </div>
            {t.due_date && (
              <div className={`text-xs shrink-0 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                {format(new Date(t.due_date), "MMM d")}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/cards/my-tasks-card.tsx
git commit -m "feat: add My Tasks dashboard card"
```

---

## Task 12: Upcoming Deadlines card

**Files:**
- Create: `components/dashboard/cards/upcoming-deadlines-card.tsx`

- [ ] **Step 1: Create the card component**

Create `components/dashboard/cards/upcoming-deadlines-card.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { format, addDays } from "date-fns";
import type { CardProps } from "@/lib/dashboard/card-registry";

interface ProjectRow {
  id: string;
  name: string;
  client_name: string | null;
  estimated_completion_date: string;
  current_phase_id: string | null;
}

interface Phase {
  id: string;
  name: string;
  color: string;
}

export default function UpcomingDeadlinesCard({ userId }: CardProps) {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const now = new Date();
    const in14 = format(addDays(now, 14), "yyyy-MM-dd");
    const today = format(now, "yyyy-MM-dd");

    Promise.all([
      supabase
        .from("projects")
        .select("id, name, client_name, estimated_completion_date, current_phase_id")
        .in("status", ["planning", "active"])
        .gte("estimated_completion_date", today)
        .lte("estimated_completion_date", in14)
        .order("estimated_completion_date"),
      supabase.from("phases").select("id, name, color"),
    ]).then(([{ data: p }, { data: ph }]) => {
      setProjects((p as ProjectRow[]) || []);
      setPhases((ph as Phase[]) || []);
      setLoading(false);
    });
  }, [userId]);

  const phaseMap = new Map(phases.map((p) => [p.id, p]));

  return (
    <ul className="divide-y">
      {loading && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">Loading...</li>
      )}
      {!loading && projects.length === 0 && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">No deadlines in the next 14 days.</li>
      )}
      {projects.map((p) => {
        const phase = p.current_phase_id ? phaseMap.get(p.current_phase_id) : null;
        return (
          <li key={p.id} className="px-5 py-3">
            <Link href={`/projects/${p.id}`} className="block hover:opacity-70 transition-opacity">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.client_name && <>{p.client_name} &middot; </>}
                    Due {format(new Date(p.estimated_completion_date), "MMM d")}
                  </div>
                </div>
                {phase && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                    style={{ backgroundColor: `${phase.color}20`, color: phase.color }}
                  >
                    {phase.name}
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/cards/upcoming-deadlines-card.tsx
git commit -m "feat: add Upcoming Deadlines dashboard card"
```

---

## Task 13: Projects by Phase card

**Files:**
- Create: `components/dashboard/cards/projects-by-phase-card.tsx`

- [ ] **Step 1: Create the card component**

Create `components/dashboard/cards/projects-by-phase-card.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CardProps } from "@/lib/dashboard/card-registry";

interface Phase {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

export default function ProjectsByPhaseCard({ userId }: CardProps) {
  const [phaseCounts, setPhaseCounts] = useState<{ phase: Phase; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from("projects")
        .select("current_phase_id")
        .in("status", ["planning", "active"]),
      supabase.from("phases").select("id, name, color, sort_order").order("sort_order"),
    ]).then(([{ data: projects }, { data: phases }]) => {
      const counts = new Map<string, number>();
      (projects || []).forEach((p) => {
        if (p.current_phase_id) {
          counts.set(p.current_phase_id, (counts.get(p.current_phase_id) || 0) + 1);
        }
      });
      const result = (phases || [])
        .map((phase) => ({ phase, count: counts.get(phase.id) || 0 }))
        .filter((r) => r.count > 0);
      setPhaseCounts(result);
      setLoading(false);
    });
  }, [userId]);

  const maxCount = Math.max(...phaseCounts.map((r) => r.count), 1);

  return (
    <div className="px-5 py-4 space-y-3">
      {loading && (
        <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
      )}
      {!loading && phaseCounts.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4">No active projects.</div>
      )}
      {phaseCounts.map(({ phase, count }) => (
        <div key={phase.id} className="flex items-center gap-3">
          <span className="text-xs font-medium w-20 truncate" style={{ color: phase.color }}>
            {phase.name}
          </span>
          <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max((count / maxCount) * 100, 8)}%`,
                backgroundColor: phase.color,
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums w-6 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/cards/projects-by-phase-card.tsx
git commit -m "feat: add Projects by Phase dashboard card with horizontal bars"
```

---

## Task 14: Team Workload card

**Files:**
- Create: `components/dashboard/cards/team-workload-card.tsx`

- [ ] **Step 1: Create the card component**

Create `components/dashboard/cards/team-workload-card.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CardProps } from "@/lib/dashboard/card-registry";

interface MemberLoad {
  id: string;
  name: string;
  count: number;
}

export default function TeamWorkloadCard({ userId }: CardProps) {
  const [members, setMembers] = useState<MemberLoad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from("tasks")
        .select("assigned_to")
        .is("completed_at", null)
        .not("assigned_to", "is", null),
      supabase.from("profiles").select("id, full_name"),
    ]).then(([{ data: tasks }, { data: profiles }]) => {
      const counts = new Map<string, number>();
      (tasks || []).forEach((t) => {
        if (t.assigned_to) {
          counts.set(t.assigned_to, (counts.get(t.assigned_to) || 0) + 1);
        }
      });
      const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name || "Unknown"]));
      const result: MemberLoad[] = [];
      counts.forEach((count, id) => {
        result.push({ id, name: profileMap.get(id) || "Unknown", count });
      });
      result.sort((a, b) => b.count - a.count);
      setMembers(result);
      setLoading(false);
    });
  }, [userId]);

  return (
    <ul className="divide-y">
      {loading && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">Loading...</li>
      )}
      {!loading && members.length === 0 && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">No assigned tasks.</li>
      )}
      {members.map((m) => (
        <li key={m.id} className="px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-medium truncate">{m.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{m.count} tasks</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/cards/team-workload-card.tsx
git commit -m "feat: add Team Workload dashboard card"
```

---

## Task 15: Personal Todos card

**Files:**
- Create: `components/dashboard/cards/personal-todos-card.tsx`

- [ ] **Step 1: Create the card component**

Create `components/dashboard/cards/personal-todos-card.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CardProps } from "@/lib/dashboard/card-registry";

interface TodoRow {
  id: string;
  title: string;
  completed_at: string | null;
}

export default function PersonalTodosCard({ userId }: CardProps) {
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("tasks")
      .select("id, title, completed_at")
      .eq("assigned_to", userId)
      .is("project_id", null)
      .is("room_id", null)
      .is("completed_at", null)
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => {
        setTodos((data as TodoRow[]) || []);
        setLoading(false);
      });
  }, [userId]);

  async function toggleComplete(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("tasks")
      .update({ completed_at: new Date().toISOString(), completed_by: userId })
      .eq("id", id);
    if (!error) {
      setTodos((prev) => prev.filter((t) => t.id !== id));
    }
  }

  return (
    <ul className="divide-y">
      {loading && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">Loading...</li>
      )}
      {!loading && todos.length === 0 && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">No personal todos.</li>
      )}
      {todos.map((t) => (
        <li key={t.id} className="px-5 py-3 flex items-center gap-3">
          <button
            onClick={() => toggleComplete(t.id)}
            className="h-4 w-4 rounded border border-muted-foreground/30 shrink-0 hover:border-foreground transition-colors"
            aria-label={`Complete "${t.title}"`}
          />
          <span className="text-sm truncate">{t.title}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/cards/personal-todos-card.tsx
git commit -m "feat: add Personal Todos dashboard card with complete toggle"
```

---

## Task 16: Notes card

**Files:**
- Create: `components/dashboard/cards/notes-card.tsx`

- [ ] **Step 1: Create the card component**

Create `components/dashboard/cards/notes-card.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CardProps } from "@/lib/dashboard/card-registry";

const STORAGE_PREFIX = "cabinet-pm-notes-";

export default function NotesCard({ userId }: CardProps) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + userId);
      if (stored) setText(stored);
    } catch {
      // ignore
    }
  }, [userId]);

  const save = useCallback(
    (value: string) => {
      try {
        localStorage.setItem(STORAGE_PREFIX + userId, value);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch {
        // ignore
      }
    },
    [userId]
  );

  function handleChange(value: string) {
    setText(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(value), 500);
  }

  return (
    <div className="px-4 py-3">
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Quick notes..."
        className="w-full min-h-[120px] text-sm bg-transparent border-0 resize-none focus:outline-none placeholder:text-muted-foreground/50"
      />
      {saved && (
        <div className="text-xs text-muted-foreground text-right">Saved</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/cards/notes-card.tsx
git commit -m "feat: add Notes dashboard card with localStorage auto-save"
```

---

## Task 17: Update dashboard page to use DashboardGrid

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Rewrite the dashboard page**

Replace the full contents of `app/(app)/dashboard/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <DashboardGrid userId={user!.id} />;
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit --pretty`
Expected: Clean — zero errors

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/dashboard/page.tsx
git commit -m "feat: replace hardcoded dashboard with customisable DashboardGrid"
```

---

## Task 18: Final verification

- [ ] **Step 1: Run type checking**

Run: `npx tsc --noEmit --pretty`
Expected: Clean — zero errors

- [ ] **Step 2: Run linter**

Run: `npx next lint`
Expected: No errors (warnings acceptable)

- [ ] **Step 3: Run dev server build check**

Run: `npx next build 2>&1 | tail -20`
Expected: Successful build

- [ ] **Step 4: Visual check in Claude Preview**

Take a screenshot of the app at `/dashboard` to verify:
- Header shows business name + page title with `/` separator
- No duplicate heading in page body
- Dashboard shows card grid with Customise button
- Cards render with data

Take a screenshot at 375px mobile width to verify:
- Bottom tabs are taller with pill active state
- Dashboard cards stack in single column
- Header shows page title without business name
