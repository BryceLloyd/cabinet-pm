# Brief 003 — Mobile FAB + Phase Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a context-aware mobile floating action button with Vaul drawer for quick-add forms, and an admin-only phase management UI in Settings with drag-to-reorder, colour picker, and soft-delete.

**Architecture:** Two independent features sharing one schema migration. The FAB is a single client component rendered in the app layout that reads `usePathname()` to determine context. The phase manager is a self-contained client component replacing the read-only phases list in settings. Both use the Supabase browser client for mutations.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, Supabase (browser client), Vaul (new), @dnd-kit (existing), Radix Popover (existing), lucide-react

**Testing:** Claude Preview (serverId: `0806f4fe-a666-4667-8695-5103dfa542a2`) with mobile preset (375×812). The migration must be applied to production Supabase before testing phase features — run the SQL in the Supabase dashboard SQL editor.

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `components/mobile-fab.tsx` | FAB button — route-aware label, click action (navigate or open drawer) |
| `components/mobile-fab-drawer.tsx` | Vaul drawer — all form variants (dashboard picker, project picker, quick task, add room) |
| `components/settings/phase-manager.tsx` | Phase CRUD — read-only/edit modes, drag reorder, colour picker, add/archive/restore |
| `supabase/migrations/008_phases_archived_at.sql` | Schema: add `archived_at` column, drop sort_order unique constraint |

### Modified files
| File | Change |
|------|--------|
| `lib/types.ts` | Add `archived_at` to Phase interface |
| `app/(app)/layout.tsx` | Add `<MobileFab />` after `<BottomTabBar />` |
| `app/(app)/settings/page.tsx` | Replace read-only phases `<ul>` with `<PhaseManager />` |
| `app/(app)/projects/page.tsx` | Add `.is("archived_at", null)` to phases query |
| `app/(app)/projects/[id]/page.tsx` | Add `.is("archived_at", null)` to phases query |
| `app/(app)/projects/new/page.tsx` | Add `.is("archived_at", null)` to phases query |
| `app/(app)/plan/page.tsx` | Add `.is("archived_at", null)` to phases query |
| `components/dashboard/cards/projects-by-phase-card.tsx` | Add `.is("archived_at", null)` to phases query |
| `components/dashboard/cards/upcoming-deadlines-card.tsx` | Add `.is("archived_at", null)` to phases query |
| `package.json` | Add `vaul` dependency |

---

### Task 1: Install vaul dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install vaul**

```bash
npm install vaul
```

Expected: `added 1 package` (vaul has zero dependencies beyond React peer).

- [ ] **Step 2: Verify installation**

```bash
node -e "require('vaul'); console.log('vaul OK')"
```

Expected: `vaul OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install vaul for mobile drawer"
```

---

### Task 2: Schema migration + Phase type update

**Files:**
- Create: `supabase/migrations/008_phases_archived_at.sql`
- Modify: `lib/types.ts`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/008_phases_archived_at.sql`:

```sql
-- Migration 008: Add archived_at for phase soft-delete, drop sort_order unique constraint for drag reorder
alter table public.phases add column archived_at timestamptz;
alter table public.phases drop constraint phases_sort_order_key;
```

The `archived_at` column is nullable — existing rows stay `null` (active). The unique constraint on `sort_order` is dropped because @dnd-kit drag reorder needs to batch-update sort orders, which conflicts with a unique constraint during the transaction.

- [ ] **Step 2: Update Phase type**

In `lib/types.ts`, change the `Phase` interface to add `archived_at`:

```typescript
export interface Phase {
  id: string;
  name: string;
  sort_order: number;
  color: string;
  is_default: boolean;
  created_at: string;
  archived_at: string | null;
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/008_phases_archived_at.sql lib/types.ts
git commit -m "feat: add phases archived_at migration and update Phase type"
```

---

### Task 3: Filter all existing phase queries for archived_at

**Files:**
- Modify: `app/(app)/settings/page.tsx`
- Modify: `app/(app)/projects/page.tsx`
- Modify: `app/(app)/projects/[id]/page.tsx`
- Modify: `app/(app)/projects/new/page.tsx`
- Modify: `app/(app)/plan/page.tsx`
- Modify: `components/dashboard/cards/projects-by-phase-card.tsx`
- Modify: `components/dashboard/cards/upcoming-deadlines-card.tsx`

Every file that queries the `phases` table needs `.is("archived_at", null)` added to only return active phases. The phase manager component (Task 7) handles its own queries including archived phases.

- [ ] **Step 1: Update settings page**

In `app/(app)/settings/page.tsx`, line 12 — change the phases query:

```typescript
// Before:
supabase.from("phases").select("*").order("sort_order"),

// After:
supabase.from("phases").select("*").is("archived_at", null).order("sort_order"),
```

- [ ] **Step 2: Update projects list page**

In `app/(app)/projects/page.tsx`, line 12 — change the phases query:

```typescript
// Before:
supabase.from("phases").select("id, name, color").order("sort_order"),

// After:
supabase.from("phases").select("id, name, color").is("archived_at", null).order("sort_order"),
```

- [ ] **Step 3: Update project detail page**

In `app/(app)/projects/[id]/page.tsx`, line 20 — change the phases query:

```typescript
// Before:
supabase.from("phases").select("*").order("sort_order"),

// After:
supabase.from("phases").select("*").is("archived_at", null).order("sort_order"),
```

- [ ] **Step 4: Update new project page**

In `app/(app)/projects/new/page.tsx`, lines 31-32 — change the phases query:

```typescript
// Before:
const { data: phase } = await supabase
  .from("phases").select("id").eq("is_default", true).maybeSingle();

// After:
const { data: phase } = await supabase
  .from("phases").select("id").eq("is_default", true).is("archived_at", null).maybeSingle();
```

- [ ] **Step 5: Update plan page**

In `app/(app)/plan/page.tsx`, line 25 — change the phases query:

```typescript
// Before:
supabase.from("phases").select("*").order("sort_order"),

// After:
supabase.from("phases").select("*").is("archived_at", null).order("sort_order"),
```

- [ ] **Step 6: Update projects-by-phase card**

In `components/dashboard/cards/projects-by-phase-card.tsx`, find the phases query and add the filter:

```typescript
// Before:
supabase.from("phases").select("id, name, color, sort_order").order("sort_order"),

// After:
supabase.from("phases").select("id, name, color, sort_order").is("archived_at", null).order("sort_order"),
```

- [ ] **Step 7: Update upcoming-deadlines card**

In `components/dashboard/cards/upcoming-deadlines-card.tsx`, find the phases query and add the filter:

```typescript
// Before:
supabase.from("phases").select("id, name, color"),

// After:
supabase.from("phases").select("id, name, color").is("archived_at", null),
```

- [ ] **Step 8: Verify build compiles**

```bash
npx next build 2>&1 | head -20
```

Expected: Build succeeds (or at least no TypeScript errors related to phases).

- [ ] **Step 9: Commit**

```bash
git add app/(app)/settings/page.tsx app/(app)/projects/page.tsx app/(app)/projects/\[id\]/page.tsx app/(app)/projects/new/page.tsx app/(app)/plan/page.tsx components/dashboard/cards/projects-by-phase-card.tsx components/dashboard/cards/upcoming-deadlines-card.tsx
git commit -m "feat: filter archived phases from all existing queries"
```

---

### Task 4: Create MobileFab button component

**Files:**
- Create: `components/mobile-fab.tsx`

- [ ] **Step 1: Create the MobileFab component**

Create `components/mobile-fab.tsx`:

```tsx
"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { MobileFabDrawer } from "@/components/mobile-fab-drawer";

export type FabDrawerMode = "dashboard-picker" | "project-picker" | "quick-task";

type FabConfig = {
  label: string;
  action: "navigate" | "drawer";
  href?: string;
  drawerMode?: FabDrawerMode;
  projectId?: string;
};

function getFabConfig(pathname: string): FabConfig | null {
  if (pathname === "/settings") return null;
  if (pathname.startsWith("/projects/new")) return null;

  if (pathname === "/dashboard") {
    return { label: "Add", action: "drawer", drawerMode: "dashboard-picker" };
  }
  if (pathname === "/plan" || pathname.startsWith("/plan?")) {
    return { label: "New project", action: "navigate", href: "/projects/new" };
  }
  if (pathname === "/projects") {
    return { label: "New project", action: "navigate", href: "/projects/new" };
  }
  if (pathname === "/tasks") {
    return { label: "New task", action: "drawer", drawerMode: "quick-task" };
  }

  // /projects/[id] — extract project ID
  const projectMatch = pathname.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    return {
      label: "Add",
      action: "drawer",
      drawerMode: "project-picker",
      projectId: projectMatch[1],
    };
  }

  return null;
}

export function MobileFab() {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const config = getFabConfig(pathname);
  if (!config) return null;

  function handleClick() {
    if (config!.action === "navigate" && config!.href) {
      router.push(config!.href);
    } else {
      setDrawerOpen(true);
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="md:hidden fixed bottom-[calc(72px+env(safe-area-inset-bottom)+12px)] left-1/2 -translate-x-1/2 z-50 h-11 px-5 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center gap-1.5 text-sm font-medium hover:opacity-90 active:scale-95 transition-transform"
      >
        <Plus size={18} strokeWidth={2.5} />
        {config.label}
      </button>
      {config.action === "drawer" && (
        <MobileFabDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          mode={config.drawerMode!}
          projectId={config.projectId}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/mobile-fab.tsx
git commit -m "feat: create MobileFab button component with route-aware config"
```

---

### Task 5: Create MobileFabDrawer component

**Files:**
- Create: `components/mobile-fab-drawer.tsx`

This component contains all the drawer content variants: dashboard picker, project detail picker, quick task form, and add room form.

- [ ] **Step 1: Create the MobileFabDrawer component**

Create `components/mobile-fab-drawer.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "vaul";
import { createClient } from "@/lib/supabase/client";
import { FolderKanban, CheckSquare, DoorOpen } from "lucide-react";
import type { FabDrawerMode } from "@/components/mobile-fab";

type DrawerView = FabDrawerMode | "add-room";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: FabDrawerMode;
  projectId?: string;
}

export function MobileFabDrawer({ open, onOpenChange, mode: initialMode, projectId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [view, setView] = useState<DrawerView>(initialMode);

  // Quick task form state
  const [title, setTitle] = useState("");
  const [taskProjectId, setTaskProjectId] = useState(projectId || "");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Add room form state
  const [roomName, setRoomName] = useState("");

  // Options loaded from Supabase
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  // Reset state when drawer opens
  useEffect(() => {
    if (open) {
      setView(initialMode);
      setTitle("");
      setRoomName("");
      setDueDate("");
      setAssignee("");
      setTaskProjectId(projectId || "");
      setSaving(false);
    }
  }, [open, initialMode, projectId]);

  // Load project/profile options when needed
  useEffect(() => {
    if (!open || optionsLoaded) return;
    Promise.all([
      supabase
        .from("projects")
        .select("id, name")
        .in("status", ["planning", "active"])
        .order("name"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
    ]).then(([{ data: p }, { data: pr }]) => {
      setProjects(p || []);
      setProfiles(pr || []);
      setOptionsLoaded(true);
    });
  }, [open, optionsLoaded, supabase]);

  async function addTask() {
    if (!title.trim() || saving) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const isPersonal = !taskProjectId;
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(),
      project_id: taskProjectId || null,
      room_id: null,
      assigned_to: isPersonal ? user.id : assignee || null,
      due_date: dueDate || null,
      created_by: user.id,
    });

    setSaving(false);
    if (!error) {
      onOpenChange(false);
      router.refresh();
    }
  }

  async function addRoom() {
    if (!roomName.trim() || !projectId || saving) return;
    setSaving(true);

    const { data: phase } = await supabase
      .from("phases")
      .select("id")
      .eq("is_default", true)
      .is("archived_at", null)
      .maybeSingle();

    const { data: existingRooms } = await supabase
      .from("rooms")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = (existingRooms?.[0]?.sort_order ?? -1) + 1;

    const { error } = await supabase.from("rooms").insert({
      project_id: projectId,
      name: roomName.trim(),
      sort_order: nextOrder,
      current_phase_id: phase?.id || null,
    });

    setSaving(false);
    if (!error) {
      onOpenChange(false);
      router.refresh();
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed bottom-0 inset-x-0 z-50 rounded-t-xl bg-background">
          <div className="mx-auto w-12 h-1.5 shrink-0 rounded-full bg-muted-foreground/20 my-3" />
          <div className="px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">

            {/* Dashboard picker */}
            {view === "dashboard-picker" && (
              <div className="space-y-2">
                <Drawer.Title className="text-base font-semibold mb-3">Quick add</Drawer.Title>
                <button
                  onClick={() => {
                    onOpenChange(false);
                    router.push("/projects/new");
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
                >
                  <FolderKanban size={20} className="text-muted-foreground shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-medium">New project</div>
                    <div className="text-xs text-muted-foreground">
                      Create a new project with rooms
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setView("quick-task")}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
                >
                  <CheckSquare size={20} className="text-muted-foreground shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-medium">New task</div>
                    <div className="text-xs text-muted-foreground">
                      Add a task or personal todo
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Project detail picker */}
            {view === "project-picker" && (
              <div className="space-y-2">
                <Drawer.Title className="text-base font-semibold mb-3">
                  Add to project
                </Drawer.Title>
                <button
                  onClick={() => setView("add-room")}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
                >
                  <DoorOpen size={20} className="text-muted-foreground shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Add room</div>
                    <div className="text-xs text-muted-foreground">
                      Add a new room to this project
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setTaskProjectId(projectId || "");
                    setView("quick-task");
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
                >
                  <CheckSquare size={20} className="text-muted-foreground shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Add task</div>
                    <div className="text-xs text-muted-foreground">
                      Create a task for this project
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Quick task form */}
            {view === "quick-task" && (
              <div className="space-y-3">
                <Drawer.Title className="text-base font-semibold">New task</Drawer.Title>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                  placeholder="What needs to be done?"
                  className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  autoFocus
                />
                <select
                  value={taskProjectId}
                  onChange={(e) => setTaskProjectId(e.target.value)}
                  className="w-full h-10 px-2 text-sm rounded-md border bg-background"
                >
                  <option value="">Personal todo</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    className="h-10 px-2 text-sm rounded-md border bg-background"
                    disabled={!taskProjectId}
                  >
                    <option value="">
                      {taskProjectId ? "Unassigned" : "Assigned to you"}
                    </option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-10 px-2 text-sm rounded-md border bg-background"
                  />
                </div>
                <button
                  onClick={addTask}
                  disabled={!title.trim() || saving}
                  className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Adding…" : "Add task"}
                </button>
              </div>
            )}

            {/* Add room form */}
            {view === "add-room" && (
              <div className="space-y-3">
                <Drawer.Title className="text-base font-semibold">Add room</Drawer.Title>
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addRoom()}
                  placeholder="e.g. Main Kitchen, Pantry"
                  className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  autoFocus
                />
                <button
                  onClick={addRoom}
                  disabled={!roomName.trim() || saving}
                  className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Adding…" : "Add room"}
                </button>
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/mobile-fab-drawer.tsx
git commit -m "feat: create MobileFabDrawer with all form variants"
```

---

### Task 6: Wire MobileFab into app layout

**Files:**
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Add MobileFab import and render**

In `app/(app)/layout.tsx`, add the import at the top alongside the existing imports:

```typescript
import { MobileFab } from "@/components/mobile-fab";
```

Then add `<MobileFab />` right after `<BottomTabBar />` (line 82):

```tsx
      <BottomTabBar />
      <MobileFab />
    </div>
  );
```

Note: `MobileFab` is a client component but it's being rendered inside a server component layout. This is fine — Next.js handles the boundary automatically via the `"use client"` directive in the component file.

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 3: Test in Preview**

Start the dev server and test on mobile viewport:
1. Navigate to `/dashboard` — FAB should appear as a primary pill with "+ Add"
2. Navigate to `/projects` — FAB should show "+ New project"
3. Navigate to `/tasks` — FAB should show "+ New task"
4. Navigate to `/settings` — FAB should be hidden
5. Tap the FAB on `/dashboard` — Vaul drawer should slide up with "New project" and "New task" options
6. Tap "New task" in the drawer — form should appear with title, project select, assignee, due date
7. Navigate to `/tasks`, tap FAB — quick task form should appear directly

- [ ] **Step 4: Commit**

```bash
git add app/(app)/layout.tsx
git commit -m "feat: wire MobileFab into app layout"
```

---

### Task 7: Create PhaseManager component

**Files:**
- Create: `components/settings/phase-manager.tsx`

This is the most complex component. It handles:
- Read-only view (non-admin or admin not editing)
- Edit mode with inline name editing
- Colour picker popover (16 Tailwind presets)
- Drag-to-reorder via @dnd-kit
- Add new phase
- Set default phase
- Archive phase (with usage check + confirm)
- Archived section with restore

- [ ] **Step 1: Create the PhaseManager component**

Create `components/settings/phase-manager.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Popover from "@radix-ui/react-popover";
import {
  GripVertical,
  Archive,
  RotateCcw,
  Plus,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { Phase } from "@/lib/types";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#14b8a6", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#d946ef", "#ec4899", "#f43f5e", "#78716c",
];

interface Props {
  initialPhases: Phase[];
  isAdmin: boolean;
}

/* ── Sortable row ── */

function SortablePhaseRow({
  phase,
  editing,
  onNameChange,
  onNameBlur,
  onColorChange,
  onSetDefault,
  onArchive,
}: {
  phase: Phase;
  editing: boolean;
  onNameChange: (id: string, name: string) => void;
  onNameBlur: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  onSetDefault: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: phase.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  if (!editing) {
    // Read-only row
    return (
      <li className="px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ backgroundColor: phase.color }}
          />
          <span className="text-sm font-medium">{phase.name}</span>
          {phase.is_default && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              default
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          #{phase.sort_order}
        </span>
      </li>
    );
  }

  // Edit-mode row
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="px-5 py-2.5 flex items-center gap-2 bg-background"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
      >
        <GripVertical size={16} />
      </button>

      {/* Colour picker */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            className="w-6 h-6 rounded-full shrink-0 ring-1 ring-border hover:ring-foreground transition-shadow"
            style={{ backgroundColor: phase.color }}
            title="Change colour"
          />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="z-50 rounded-lg border bg-popover p-3 shadow-md"
            sideOffset={8}
            align="start"
          >
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onColorChange(phase.id, c)}
                  className="w-6 h-6 rounded-full ring-1 ring-border hover:scale-110 transition-transform flex items-center justify-center"
                  style={{ backgroundColor: c }}
                >
                  {c === phase.color && (
                    <Check size={12} className="text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
            <Popover.Arrow className="fill-border" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Name input */}
      <input
        value={phase.name}
        onChange={(e) => onNameChange(phase.id, e.target.value)}
        onBlur={() => onNameBlur(phase.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="flex-1 h-8 px-2 text-sm rounded-md border bg-background min-w-0"
      />

      {/* Default radio */}
      <button
        onClick={() => !phase.is_default && onSetDefault(phase.id)}
        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          phase.is_default
            ? "border-primary bg-primary"
            : "border-muted-foreground/40 hover:border-primary"
        }`}
        title={phase.is_default ? "Default phase" : "Set as default"}
      >
        {phase.is_default && <Check size={12} className="text-primary-foreground" />}
      </button>

      {/* Archive button */}
      <button
        onClick={() => onArchive(phase.id)}
        disabled={phase.is_default}
        className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
        title={phase.is_default ? "Cannot archive the default phase" : "Archive phase"}
      >
        <Archive size={16} />
      </button>
    </li>
  );
}

/* ── Main component ── */

export function PhaseManager({ initialPhases, isAdmin }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [phases, setPhases] = useState<Phase[]>(
    initialPhases.filter((p) => !p.archived_at)
  );
  const [archivedPhases, setArchivedPhases] = useState<Phase[]>(
    initialPhases.filter((p) => !!p.archived_at)
  );
  const [showArchived, setShowArchived] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  /* ── Name editing ── */

  const handleNameChange = useCallback((id: string, name: string) => {
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, []);

  const handleNameBlur = useCallback(
    async (id: string) => {
      const phase = phases.find((p) => p.id === id);
      if (!phase || !phase.name.trim()) return;
      await supabase
        .from("phases")
        .update({ name: phase.name.trim() })
        .eq("id", id);
    },
    [phases, supabase]
  );

  /* ── Colour change ── */

  const handleColorChange = useCallback(
    async (id: string, color: string) => {
      setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, color } : p)));
      await supabase.from("phases").update({ color }).eq("id", id);
    },
    [supabase]
  );

  /* ── Set default ── */

  const handleSetDefault = useCallback(
    async (id: string) => {
      setPhases((prev) =>
        prev.map((p) => ({ ...p, is_default: p.id === id }))
      );
      // The DB trigger enforce_single_default_phase handles unsetting the old default
      await supabase.from("phases").update({ is_default: true }).eq("id", id);
    },
    [supabase]
  );

  /* ── Drag reorder ── */

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = phases.findIndex((p) => p.id === active.id);
    const newIndex = phases.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(phases, oldIndex, newIndex).map((p, i) => ({
      ...p,
      sort_order: i,
    }));
    setPhases(reordered);

    // Batch update sort_orders
    await Promise.all(
      reordered.map((p, i) =>
        supabase.from("phases").update({ sort_order: i }).eq("id", p.id)
      )
    );
  }

  /* ── Add phase ── */

  async function handleAddPhase() {
    const maxOrder = phases.reduce((max, p) => Math.max(max, p.sort_order), -1);
    const randomColor =
      PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];

    const { data, error } = await supabase
      .from("phases")
      .insert({
        name: "New phase",
        sort_order: maxOrder + 1,
        color: randomColor,
        is_default: false,
      })
      .select("*")
      .single();

    if (!error && data) {
      setPhases([...phases, data as Phase]);
    }
  }

  /* ── Archive phase ── */

  const handleArchive = useCallback(
    async (id: string) => {
      const phase = phases.find((p) => p.id === id);
      if (!phase || phase.is_default) return;

      // Check usage
      const { count } = await supabase
        .from("rooms")
        .select("id", { count: "exact", head: true })
        .eq("current_phase_id", id);

      if (count && count > 0) {
        const proceed = confirm(
          `${count} room${count !== 1 ? "s are" : " is"} currently in the "${phase.name}" phase. Archiving won't remove them, but this phase won't be available for new assignments. Archive anyway?`
        );
        if (!proceed) return;
      }

      const { error } = await supabase
        .from("phases")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);

      if (!error) {
        const archived = { ...phase, archived_at: new Date().toISOString() };
        setPhases((prev) => prev.filter((p) => p.id !== id));
        setArchivedPhases((prev) => [...prev, archived]);
      }
    },
    [phases, supabase]
  );

  /* ── Restore phase ── */

  async function handleRestore(id: string) {
    const phase = archivedPhases.find((p) => p.id === id);
    if (!phase) return;

    const maxOrder = phases.reduce((max, p) => Math.max(max, p.sort_order), -1);

    const { error } = await supabase
      .from("phases")
      .update({ archived_at: null, sort_order: maxOrder + 1 })
      .eq("id", id);

    if (!error) {
      const restored = { ...phase, archived_at: null, sort_order: maxOrder + 1 };
      setArchivedPhases((prev) => prev.filter((p) => p.id !== id));
      setPhases((prev) => [...prev, restored]);
    }
  }

  /* ── Done editing ── */

  function handleDone() {
    setEditing(false);
    router.refresh(); // Reload server data to sync
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3.5 border-b flex items-center justify-between">
        <h2 className="font-medium">{editing ? "Edit phases" : "Phases"}</h2>
        {isAdmin && (
          <button
            onClick={editing ? handleDone : () => setEditing(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {editing ? "Done" : "Edit phases"}
          </button>
        )}
      </div>

      {editing ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={phases.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="divide-y">
              {phases.map((phase) => (
                <SortablePhaseRow
                  key={phase.id}
                  phase={phase}
                  editing
                  onNameChange={handleNameChange}
                  onNameBlur={handleNameBlur}
                  onColorChange={handleColorChange}
                  onSetDefault={handleSetDefault}
                  onArchive={handleArchive}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <ul className="divide-y">
          {phases.map((phase) => (
            <SortablePhaseRow
              key={phase.id}
              phase={phase}
              editing={false}
              onNameChange={() => {}}
              onNameBlur={() => {}}
              onColorChange={() => {}}
              onSetDefault={() => {}}
              onArchive={() => {}}
            />
          ))}
        </ul>
      )}

      {/* Add phase button */}
      {editing && (
        <div className="px-5 py-3 border-t">
          <button
            onClick={handleAddPhase}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Plus size={14} />
            Add phase
          </button>
        </div>
      )}

      {/* Archived section */}
      {editing && archivedPhases.length > 0 && (
        <div className="border-t">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="w-full px-5 py-3 flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Archived ({archivedPhases.length})
          </button>
          {showArchived && (
            <ul className="divide-y border-t">
              {archivedPhases.map((phase) => (
                <li
                  key={phase.id}
                  className="px-5 py-3 flex items-center justify-between opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: phase.color }}
                    />
                    <span className="text-sm">{phase.name}</span>
                  </div>
                  <button
                    onClick={() => handleRestore(phase.id)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <RotateCcw size={12} />
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -10
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/settings/phase-manager.tsx
git commit -m "feat: create PhaseManager component with CRUD, drag reorder, and colour picker"
```

---

### Task 8: Wire PhaseManager into settings page

**Files:**
- Modify: `app/(app)/settings/page.tsx`

- [ ] **Step 1: Add PhaseManager import**

Add to the imports at the top of `app/(app)/settings/page.tsx`:

```typescript
import { PhaseManager } from "@/components/settings/phase-manager";
```

- [ ] **Step 2: Replace the read-only phases section**

Replace the entire `{/* Phases */}` section (lines 83-100, the `<section>` block with the read-only `<ul>`) with:

```tsx
      {/* Phases */}
      <PhaseManager initialPhases={phases || []} isAdmin={isAdmin} />
```

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/settings/page.tsx
git commit -m "feat: wire PhaseManager into settings page, replacing read-only list"
```

---

### Task 9: Visual verification in Preview

**Prerequisites:** Migration 008 must be applied to production Supabase before testing phase management. Run this SQL in the Supabase dashboard SQL editor:

```sql
alter table public.phases add column archived_at timestamptz;
alter table public.phases drop constraint phases_sort_order_key;
```

**Testing checklist (mobile viewport 375×812):**

- [ ] **Step 1: FAB on dashboard**

Navigate to `/dashboard`. Verify:
- Primary pill FAB visible at bottom-center, above tab bar
- Label says "+ Add"
- Tapping opens drawer with "New project" and "New task" options
- "New project" navigates to `/projects/new`
- "New task" shows quick task form

- [ ] **Step 2: FAB on projects page**

Navigate to `/projects`. Verify:
- FAB says "+ New project"
- Tapping navigates to `/projects/new` (no drawer)

- [ ] **Step 3: FAB on tasks page**

Navigate to `/tasks`. Verify:
- FAB says "+ New task"
- Tapping opens drawer with quick task form
- Can fill in title, select project, due date
- Submit creates the task and drawer closes

- [ ] **Step 4: FAB on project detail**

Navigate to a project detail page (`/projects/[id]`). Verify:
- FAB says "+ Add"
- Tapping opens drawer with "Add room" and "Add task" options
- "Add room" shows room name input and adds to the project
- "Add task" shows task form pre-scoped to the project

- [ ] **Step 5: FAB hidden on settings**

Navigate to `/settings`. Verify FAB is not visible.

- [ ] **Step 6: FAB hidden on desktop**

Switch to desktop viewport. Verify FAB is not visible on any page.

- [ ] **Step 7: Phase manager — read-only (non-admin)**

If possible, test as non-admin user. Settings → Phases section should show read-only list without "Edit phases" button.

- [ ] **Step 8: Phase manager — edit mode**

As admin, navigate to `/settings`. Verify:
- "Edit phases" button visible in Phases section header
- Clicking it enters edit mode with drag handles, colour swatches, name inputs, default radios, archive buttons

- [ ] **Step 9: Phase manager — colour picker**

In edit mode, click a colour swatch. Verify:
- Popover appears with 16 colour circles
- Current colour has a check mark
- Clicking a different colour updates immediately

- [ ] **Step 10: Phase manager — drag reorder**

In edit mode, drag a phase by its handle. Verify:
- Phase moves smoothly
- Sort order updates after drop

- [ ] **Step 11: Phase manager — add phase**

Click "Add phase" at the bottom. Verify:
- New phase appears with name "New phase"
- Can edit the name inline

- [ ] **Step 12: Phase manager — set default**

Click the radio button on a non-default phase. Verify:
- Old default loses its indicator
- New default gets the indicator
- Only one default at a time

- [ ] **Step 13: Phase manager — archive and restore**

Click archive on a non-default phase. Verify:
- If rooms use it, confirmation dialog appears
- Phase disappears from active list
- "Archived (N)" section appears
- Clicking "Restore" brings it back

- [ ] **Step 14: Done editing**

Click "Done". Verify:
- Reverts to read-only view
- All changes persisted (refresh page to confirm)
