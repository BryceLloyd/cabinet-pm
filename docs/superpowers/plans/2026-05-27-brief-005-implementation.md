# Brief 005 — Room Groups + Per-Project Phase Planning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add room groups (installation batches) to projects, per-group phase scheduling with a project Gantt, expandable year plan rows, and room-group assignment on tasks.

**Architecture:** New `room_groups` and `phase_plans` tables extend the project→room hierarchy. A `RoomGroupManager` component on the project detail page handles group CRUD. A `PlanningSection` renders an SVG Gantt of group×phase date ranges with a table editor. The existing year plan Gantt gains expand/collapse per project to show group sub-bars (per-user toggle).

**Tech Stack:** Supabase (Postgres migrations, RLS), Next.js App Router, SVG Gantt, @dnd-kit (already installed), date-fns

---

### Task 1: Database migration + type updates

**Files:**
- Create: `supabase/migrations/010_room_groups.sql`
- Modify: `lib/types.ts`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/010_room_groups.sql`:

```sql
-- Room groups: installation batches within a project
CREATE TABLE room_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX room_groups_project_idx ON room_groups(project_id);

ALTER TABLE room_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage room_groups"
  ON room_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Rooms gain optional group assignment
ALTER TABLE rooms ADD COLUMN room_group_id uuid REFERENCES room_groups(id) ON DELETE SET NULL;
CREATE INDEX rooms_room_group_idx ON rooms(room_group_id);

-- Phase plans: date ranges per (group × phase) or (project × phase)
CREATE TABLE phase_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_group_id   uuid REFERENCES room_groups(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  phase_id        uuid NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT phase_plans_one_parent CHECK (
    (room_group_id IS NOT NULL AND project_id IS NULL) OR
    (room_group_id IS NULL AND project_id IS NOT NULL)
  )
);

CREATE INDEX phase_plans_group_idx ON phase_plans(room_group_id);
CREATE INDEX phase_plans_project_idx ON phase_plans(project_id);
CREATE INDEX phase_plans_date_range_idx ON phase_plans(start_date, end_date);

ALTER TABLE phase_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage phase_plans"
  ON phase_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tasks gain optional room group assignment
ALTER TABLE tasks ADD COLUMN room_group_id uuid REFERENCES room_groups(id) ON DELETE SET NULL;
CREATE INDEX tasks_room_group_idx ON tasks(room_group_id);

-- Profile preference for year plan expansion
ALTER TABLE profiles ADD COLUMN show_room_groups boolean NOT NULL DEFAULT true;
```

- [ ] **Step 2: Run migration against linked Supabase**

```bash
npx supabase db query --linked < supabase/migrations/010_room_groups.sql
```

Verify no errors. Confirm tables exist:
```bash
npx supabase db query --linked -c "SELECT table_name FROM information_schema.tables WHERE table_name IN ('room_groups','phase_plans') AND table_schema='public';"
```

Expected: both `room_groups` and `phase_plans` listed.

- [ ] **Step 3: Update lib/types.ts**

Add after the `RoomPhaseHistory` interface (after line 91):

```typescript
export interface RoomGroup {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  notes: string | null;
  created_at: string;
}

export interface PhasePlan {
  id: string;
  room_group_id: string | null;
  project_id: string | null;
  phase_id: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}
```

Add `room_group_id` to the `Room` interface (after `sort_order`):

```typescript
  room_group_id: string | null;
```

Add `room_group_id` to the `Task` interface (after `room_id`):

```typescript
  room_group_id: string | null;
```

Add `show_room_groups` to the `Profile` interface (after `notification_preferences`):

```typescript
  show_room_groups: boolean;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/010_room_groups.sql lib/types.ts
git commit -m "feat: add room_groups, phase_plans tables and type updates"
```

---

### Task 2: Room group manager component

**Files:**
- Create: `components/projects/room-group-manager.tsx`

This component manages room groups on the project detail page: list, create, rename, delete, reorder via @dnd-kit.

- [ ] **Step 1: Create the component**

Create `components/projects/room-group-manager.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { RoomGroup } from "@/lib/types";

interface Props {
  projectId: string;
  initialGroups: RoomGroup[];
  roomCountMap: Record<string, number>; // group_id → room count
}

function SortableGroupRow({
  group,
  roomCount,
  onRename,
  onDelete,
}: {
  group: RoomGroup;
  roomCount: number;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  function save() {
    if (name.trim() && name.trim() !== group.name) {
      onRename(group.id, name.trim());
    }
    setEditing(false);
  }

  return (
    <li ref={setNodeRef} style={style} className="px-4 py-2.5 flex items-center gap-2 group">
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/>
          <circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>
        </svg>
      </button>
      {editing ? (
        <div className="flex-1 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            className="flex-1 h-7 px-2 text-sm rounded-md border bg-background"
            autoFocus
          />
          <button onClick={save} className="h-7 px-2 rounded-md bg-primary text-primary-foreground text-xs font-medium">Save</button>
          <button onClick={() => { setName(group.name); setEditing(false); }} className="h-7 px-2 rounded-md border text-xs">Cancel</button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-sm font-medium">{group.name}</span>
          <span className="text-xs text-muted-foreground">{roomCount} room{roomCount !== 1 ? "s" : ""}</span>
          <button
            onClick={() => setEditing(true)}
            className="h-6 w-6 rounded grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
            title="Rename"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(group.id)}
            className="h-6 w-6 rounded grid place-items-center text-muted-foreground hover:text-destructive hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete group"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
          </button>
        </>
      )}
    </li>
  );
}

export function RoomGroupManager({ projectId, initialGroups, roomCountMap }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [groups, setGroups] = useState(initialGroups);
  const [newName, setNewName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  async function addGroup() {
    if (!newName.trim()) return;
    const { data, error } = await supabase
      .from("room_groups")
      .insert({ project_id: projectId, name: newName.trim(), sort_order: groups.length })
      .select("*")
      .single();
    if (!error && data) {
      setGroups([...groups, data as RoomGroup]);
      setNewName("");
    }
  }

  async function renameGroup(id: string, name: string) {
    const { error } = await supabase.from("room_groups").update({ name }).eq("id", id);
    if (!error) {
      setGroups(groups.map((g) => (g.id === id ? { ...g, name } : g)));
    }
  }

  async function deleteGroup(id: string) {
    const count = roomCountMap[id] || 0;
    const msg = count > 0
      ? `Delete "${groups.find((g) => g.id === id)?.name}"? Its ${count} room(s) will become ungrouped.`
      : `Delete "${groups.find((g) => g.id === id)?.name}"?`;
    if (!confirm(msg)) return;
    const { error } = await supabase.from("room_groups").delete().eq("id", id);
    if (!error) {
      setGroups(groups.filter((g) => g.id !== id));
      router.refresh();
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = groups.findIndex((g) => g.id === active.id);
    const newIndex = groups.findIndex((g) => g.id === over.id);
    const reordered = arrayMove(groups, oldIndex, newIndex).map((g, i) => ({
      ...g,
      sort_order: i,
    }));
    setGroups(reordered);
    await Promise.all(
      reordered.map((g, i) =>
        supabase.from("room_groups").update({ sort_order: i }).eq("id", g.id)
      )
    );
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3.5 border-b">
        <h2 className="font-medium">Room groups</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Group rooms by installation batch (delivered and installed together).
        </p>
      </div>
      {groups.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y">
              {groups.map((g) => (
                <SortableGroupRow
                  key={g.id}
                  group={g}
                  roomCount={roomCountMap[g.id] || 0}
                  onRename={renameGroup}
                  onDelete={deleteGroup}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="px-5 py-6 text-sm text-muted-foreground text-center">
          No groups yet. Create one to batch rooms for installation.
        </div>
      )}
      <div className="px-4 py-3 border-t flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addGroup()}
          placeholder="New group (e.g. Kitchen Install)"
          className="flex-1 h-8 px-3 text-sm rounded-md border bg-background"
        />
        <button onClick={addGroup} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
          Add
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/projects/room-group-manager.tsx
git commit -m "feat: create RoomGroupManager component with CRUD and drag-reorder"
```

---

### Task 3: Wire room groups into project detail page

**Files:**
- Modify: `app/(app)/projects/[id]/page.tsx`
- Modify: `components/projects/project-detail-client.tsx`

- [ ] **Step 1: Update the server page to fetch room groups**

In `app/(app)/projects/[id]/page.tsx`, add `room_groups` to the parallel fetch. The current `Promise.all` fetches project, rooms, tasks, phases, profiles. Add a 6th query:

```typescript
supabase.from("room_groups").select("*").eq("project_id", id).order("sort_order"),
```

Destructure as `{ data: roomGroups }` and pass `roomGroups={roomGroups || []}` to `ProjectDetailClient`.

- [ ] **Step 2: Update ProjectDetailClient props and state**

In `components/projects/project-detail-client.tsx`:

Add import at top:
```typescript
import type { Project, Room, Task, Phase, Profile, ProjectStatus, RoomGroup } from "@/lib/types";
import { RoomGroupManager } from "@/components/projects/room-group-manager";
```

Update the Props interface to add:
```typescript
  initialRoomGroups: RoomGroup[];
```

Update the component signature to destructure `initialRoomGroups`.

Add state:
```typescript
const [roomGroups, setRoomGroups] = useState(initialRoomGroups);
```

Compute `roomCountMap`:
```typescript
const roomCountMap: Record<string, number> = {};
rooms.forEach((r) => {
  if (r.room_group_id) {
    roomCountMap[r.room_group_id] = (roomCountMap[r.room_group_id] || 0) + 1;
  }
});
```

- [ ] **Step 3: Add RoomGroupManager section to the JSX**

Insert the `<RoomGroupManager>` section above the existing Rooms section (before `{/* Rooms */}`). Place it spanning the full grid width:

```tsx
{/* Room Groups */}
<section className="lg:col-span-5">
  <RoomGroupManager
    projectId={project.id}
    initialGroups={roomGroups}
    roomCountMap={roomCountMap}
  />
</section>
```

- [ ] **Step 4: Add room group picker to each room row**

In the room row (the non-editing branch, around line 392), add a group picker `<select>` before the phase picker:

```tsx
<select
  value={room.room_group_id || ""}
  onChange={(e) => changeRoomGroup(room.id, e.target.value || null)}
  className="h-7 px-2 text-xs rounded-md border bg-background"
>
  <option value="">No group</option>
  {roomGroups.map((g) => (
    <option key={g.id} value={g.id}>{g.name}</option>
  ))}
</select>
```

Add the handler function:

```typescript
async function changeRoomGroup(roomId: string, groupId: string | null) {
  const { error } = await supabase
    .from("rooms")
    .update({ room_group_id: groupId })
    .eq("id", roomId);
  if (!error) {
    setRooms(rooms.map((r) => (r.id === roomId ? { ...r, room_group_id: groupId } : r)));
  }
}
```

- [ ] **Step 5: Verify in browser**

Navigate to a project detail page. Verify:
- Room groups section appears above rooms
- Can create a group
- Can rename a group
- Can delete a group
- Room rows show group picker dropdown
- Selecting a group updates the room

- [ ] **Step 6: Commit**

```bash
git add app/(app)/projects/[id]/page.tsx components/projects/project-detail-client.tsx
git commit -m "feat: wire room groups into project detail page with group picker on rooms"
```

---

### Task 4: Planning section — auto-fill logic

**Files:**
- Create: `lib/phase-plans.ts`

Pure utility module for phase plan auto-fill — no UI, just date math. Used by both the planning section and future consumers.

- [ ] **Step 1: Create the auto-fill utility**

Create `lib/phase-plans.ts`:

```typescript
import { addDays, differenceInDays, isWeekend, parseISO } from "date-fns";
import type { Phase, RoomGroup } from "@/lib/types";

/**
 * Skip weekends: advance date forward until it lands on a weekday.
 */
function nextWeekday(date: Date): Date {
  let d = new Date(date);
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

/**
 * Count working days (Mon-Fri) between two dates inclusive.
 */
function workingDaysBetween(start: Date, end: Date): number {
  let count = 0;
  let d = new Date(start);
  while (d <= end) {
    if (!isWeekend(d)) count++;
    d = addDays(d, 1);
  }
  return count;
}

export interface AutoFillEntry {
  room_group_id: string | null;
  project_id: string | null;
  phase_id: string;
  start_date: string; // ISO date
  end_date: string;   // ISO date
}

/**
 * Generate phase plan entries by distributing phases equally across the project timeline.
 * Creates one set of entries per target (each room group, or project-level if no groups).
 *
 * @param projectStart - ISO date string for project start
 * @param projectEnd - ISO date string for estimated completion
 * @param phases - Active phases sorted by sort_order
 * @param groups - Room groups for this project (may be empty)
 * @param projectId - Project ID (used for project-level fallback)
 */
export function autoFillPhasePlans(
  projectStart: string,
  projectEnd: string,
  phases: Phase[],
  groups: RoomGroup[],
  projectId: string
): AutoFillEntry[] {
  if (phases.length === 0) return [];

  const start = parseISO(projectStart);
  const end = parseISO(projectEnd);
  const totalDays = Math.max(1, differenceInDays(end, start) + 1);
  const daysPerPhase = Math.floor(totalDays / phases.length);
  const remainder = totalDays - daysPerPhase * phases.length;

  // Targets: one set per group, plus project-level if no groups or ungrouped rooms exist
  const targets: { room_group_id: string | null; project_id: string | null }[] =
    groups.length > 0
      ? groups.map((g) => ({ room_group_id: g.id, project_id: null }))
      : [{ room_group_id: null, project_id: projectId }];

  const entries: AutoFillEntry[] = [];

  for (const target of targets) {
    let cursor = new Date(start);

    phases.forEach((phase, i) => {
      const phaseStart = nextWeekday(cursor);
      const phaseDays = daysPerPhase + (i < remainder ? 1 : 0);
      // Advance by phaseDays calendar days, then back up to land on a weekday
      let phaseEnd = addDays(phaseStart, Math.max(0, phaseDays - 1));
      while (isWeekend(phaseEnd)) phaseEnd = addDays(phaseEnd, -1);
      // Edge case: if phaseEnd < phaseStart, just use phaseStart
      if (phaseEnd < phaseStart) phaseEnd = phaseStart;

      entries.push({
        room_group_id: target.room_group_id,
        project_id: target.project_id,
        phase_id: phase.id,
        start_date: phaseStart.toISOString().split("T")[0],
        end_date: phaseEnd.toISOString().split("T")[0],
      });

      cursor = addDays(phaseEnd, 1);
    });
  }

  return entries;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/phase-plans.ts
git commit -m "feat: add auto-fill utility for distributing phase plans across project timeline"
```

---

### Task 5: Project Gantt component

**Files:**
- Create: `components/projects/project-gantt.tsx`

Read-only SVG Gantt for a single project's phase plans. Renders one row per room group (or one "Project" row if no groups), with coloured phase bars.

- [ ] **Step 1: Create the component**

Create `components/projects/project-gantt.tsx`:

```tsx
"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import {
  differenceInDays,
  parseISO,
  eachMonthOfInterval,
  format,
  endOfMonth,
  startOfMonth,
} from "date-fns";
import type { Phase, PhasePlan, RoomGroup } from "@/lib/types";

interface Props {
  projectStart: string;
  projectEnd: string;
  groups: RoomGroup[];
  phasePlans: PhasePlan[];
  phases: Phase[];
}

const ROW_H = 36;
const HEADER_H = 28;

export function ProjectGantt({ projectStart, projectEnd, groups, phasePlans, phases }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      setContainerW(entries[0].contentRect.width);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const phaseMap = useMemo(() => new Map(phases.map((p) => [p.id, p])), [phases]);

  const start = parseISO(projectStart);
  const end = parseISO(projectEnd);
  const totalDays = Math.max(1, differenceInDays(end, start) + 1);
  const months = eachMonthOfInterval({ start, end });

  // Rows: one per group, or one "Project" row if no groups
  const rows: { id: string; label: string }[] =
    groups.length > 0
      ? groups.map((g) => ({ id: g.id, label: g.name }))
      : [{ id: "__project__", label: "Project" }];

  const LABEL_W = Math.max(100, Math.min(200, containerW * 0.2));
  const TIMELINE_W = Math.max(400, containerW - LABEL_W);
  const dayW = TIMELINE_W / totalDays;
  const height = HEADER_H + rows.length * ROW_H;

  const today = new Date();
  const todayInRange = today >= start && today <= end;

  if (containerW === 0) {
    return <div ref={containerRef} className="h-24" />;
  }

  return (
    <div ref={containerRef} className="overflow-x-auto">
      <svg width={LABEL_W + TIMELINE_W} height={height} className="block">
        {/* Month grid */}
        <g>
          {months.map((m, i) => {
            const x = LABEL_W + differenceInDays(m, start) * dayW;
            const w = (differenceInDays(endOfMonth(m), m) + 1) * dayW;
            return (
              <g key={i}>
                <line x1={x} y1={0} x2={x} y2={height} stroke="hsl(var(--border))" strokeWidth={0.5} />
                <text x={x + w / 2} y={18} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
                  {format(m, "MMM")}
                </text>
              </g>
            );
          })}
          <line x1={LABEL_W} y1={HEADER_H} x2={LABEL_W + TIMELINE_W} y2={HEADER_H} stroke="hsl(var(--border))" />
          <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={height} stroke="hsl(var(--border))" />
        </g>

        {/* Rows */}
        {rows.map((row, i) => {
          const rowY = HEADER_H + i * ROW_H;
          // Find phase plans for this row
          const plans = phasePlans.filter((pp) =>
            row.id === "__project__"
              ? pp.project_id !== null
              : pp.room_group_id === row.id
          );

          return (
            <g key={row.id}>
              <line x1={0} y1={rowY} x2={LABEL_W + TIMELINE_W} y2={rowY} stroke="hsl(var(--border))" strokeWidth={0.5} />
              <text x={8} y={rowY + 22} fontSize={11} className="fill-foreground" fontWeight={500}>
                {row.label.length > 20 ? row.label.slice(0, 20) + "…" : row.label}
              </text>
              {plans.map((pp) => {
                const phase = phaseMap.get(pp.phase_id);
                if (!phase) return null;
                const ppStart = parseISO(pp.start_date);
                const ppEnd = parseISO(pp.end_date);
                const x = LABEL_W + Math.max(0, differenceInDays(ppStart, start)) * dayW;
                const w = Math.max(2, (differenceInDays(ppEnd, ppStart) + 1) * dayW);
                const barY = rowY + 8;
                return (
                  <g key={pp.id}>
                    <rect x={x} y={barY} width={w} height={20} rx={3} fill={phase.color} fillOpacity={0.85} />
                    {w > 40 && (
                      <text x={x + 4} y={barY + 14} fontSize={9} fill="white" fontWeight={500}>
                        {phase.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Today line */}
        {todayInRange && (() => {
          const todayX = LABEL_W + differenceInDays(today, start) * dayW;
          return (
            <line x1={todayX} y1={0} x2={todayX} y2={height} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" />
          );
        })()}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/projects/project-gantt.tsx
git commit -m "feat: create ProjectGantt SVG component for per-project phase visualization"
```

---

### Task 6: Phase plan table editor

**Files:**
- Create: `components/projects/phase-plan-table.tsx`

Editable table of group × phase × start × end date pickers. Debounced saves. Soft warning on overlapping dates.

- [ ] **Step 1: Create the component**

Create `components/projects/phase-plan-table.tsx`:

```tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { PhasePlan, Phase, RoomGroup } from "@/lib/types";

interface Props {
  plans: PhasePlan[];
  phases: Phase[];
  groups: RoomGroup[];
  onUpdate: (updated: PhasePlan[]) => void;
}

export function PhasePlanTable({ plans, phases, groups, onUpdate }: Props) {
  const supabase = createClient();
  const [localPlans, setLocalPlans] = useState(plans);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const phaseMap = new Map(phases.map((p) => [p.id, p]));

  // Rows: one per group, or one "Project" row
  const rows: { id: string; label: string; isProject: boolean }[] =
    groups.length > 0
      ? groups.map((g) => ({ id: g.id, label: g.name, isProject: false }))
      : [{ id: "__project__", label: "Project", isProject: true }];

  const debouncedSave = useCallback(
    (planId: string, field: "start_date" | "end_date", value: string) => {
      if (saveTimers.current[planId]) clearTimeout(saveTimers.current[planId]);
      saveTimers.current[planId] = setTimeout(async () => {
        await supabase
          .from("phase_plans")
          .update({ [field]: value, updated_at: new Date().toISOString() })
          .eq("id", planId);
      }, 800);
    },
    [supabase]
  );

  function handleDateChange(planId: string, field: "start_date" | "end_date", value: string) {
    const updated = localPlans.map((p) =>
      p.id === planId ? { ...p, [field]: value } : p
    );
    setLocalPlans(updated);
    onUpdate(updated);
    debouncedSave(planId, field, value);
  }

  function hasOverlap(rowId: string, planId: string, start: string, end: string): boolean {
    const rowPlans = localPlans.filter((p) =>
      rowId === "__project__" ? p.project_id !== null : p.room_group_id === rowId
    );
    return rowPlans.some((p) => {
      if (p.id === planId) return false;
      return p.start_date <= end && p.end_date >= start;
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left px-3 py-2 font-medium">Group</th>
            <th className="text-left px-3 py-2 font-medium">Phase</th>
            <th className="text-left px-3 py-2 font-medium">Start</th>
            <th className="text-left px-3 py-2 font-medium">End</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowPlans = localPlans
              .filter((p) =>
                row.isProject ? p.project_id !== null : p.room_group_id === row.id
              )
              .sort((a, b) => {
                const phaseA = phaseMap.get(a.phase_id);
                const phaseB = phaseMap.get(b.phase_id);
                return (phaseA?.sort_order ?? 0) - (phaseB?.sort_order ?? 0);
              });

            return rowPlans.map((plan, j) => {
              const phase = phaseMap.get(plan.phase_id);
              const overlap = hasOverlap(row.id, plan.id, plan.start_date, plan.end_date);
              const outOfOrder =
                plan.start_date > plan.end_date;

              return (
                <tr key={plan.id} className="border-b">
                  {j === 0 && (
                    <td className="px-3 py-2 font-medium align-top" rowSpan={rowPlans.length}>
                      {row.label}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: phase?.color || "#94a3b8" }}
                      />
                      {phase?.name || "Unknown"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={plan.start_date}
                      onChange={(e) => handleDateChange(plan.id, "start_date", e.target.value)}
                      className={`h-7 px-2 text-xs rounded-md border bg-background ${
                        overlap || outOfOrder ? "border-yellow-500" : ""
                      }`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={plan.end_date}
                      onChange={(e) => handleDateChange(plan.id, "end_date", e.target.value)}
                      className={`h-7 px-2 text-xs rounded-md border bg-background ${
                        overlap || outOfOrder ? "border-yellow-500" : ""
                      }`}
                    />
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground px-3 py-2">
        Yellow borders indicate overlapping or out-of-order dates. Changes save automatically.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/projects/phase-plan-table.tsx
git commit -m "feat: create PhasePlanTable component with debounced saves and overlap warnings"
```

---

### Task 7: Planning section orchestrator

**Files:**
- Create: `components/projects/planning-section.tsx`
- Modify: `components/projects/project-detail-client.tsx`

Orchestrates the Gantt + table: loads phase plans, triggers auto-fill if empty, manages state.

- [ ] **Step 1: Create the planning section component**

Create `components/projects/planning-section.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProjectGantt } from "@/components/projects/project-gantt";
import { PhasePlanTable } from "@/components/projects/phase-plan-table";
import { autoFillPhasePlans } from "@/lib/phase-plans";
import type { Phase, PhasePlan, RoomGroup } from "@/lib/types";

interface Props {
  projectId: string;
  projectStart: string;
  projectEnd: string;
  phases: Phase[];
  groups: RoomGroup[];
}

export function PlanningSection({ projectId, projectStart, projectEnd, phases, groups }: Props) {
  const supabase = createClient();
  const [plans, setPlans] = useState<PhasePlan[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlans = useCallback(async () => {
    // Fetch existing plans for this project's groups + project-level fallback
    const groupIds = groups.map((g) => g.id);
    let allPlans: PhasePlan[] = [];

    if (groupIds.length > 0) {
      const { data } = await supabase
        .from("phase_plans")
        .select("*")
        .in("room_group_id", groupIds);
      if (data) allPlans = [...allPlans, ...(data as PhasePlan[])];
    }

    // Also fetch project-level plans
    const { data: projectPlans } = await supabase
      .from("phase_plans")
      .select("*")
      .eq("project_id", projectId)
      .is("room_group_id", null);
    if (projectPlans) allPlans = [...allPlans, ...(projectPlans as PhasePlan[])];

    return allPlans;
  }, [supabase, groups, projectId]);

  useEffect(() => {
    (async () => {
      let existing = await loadPlans();

      // Auto-fill if no plans exist
      if (existing.length === 0 && phases.length > 0) {
        const entries = autoFillPhasePlans(projectStart, projectEnd, phases, groups, projectId);
        if (entries.length > 0) {
          const { data } = await supabase
            .from("phase_plans")
            .insert(entries)
            .select("*");
          if (data) existing = data as PhasePlan[];
        }
      }

      setPlans(existing);
      setLoading(false);
    })();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Planning</h2>
        </div>
        <div className="px-5 py-8 text-sm text-muted-foreground text-center animate-pulse">
          Loading phase plans…
        </div>
      </section>
    );
  }

  if (plans.length === 0) {
    return (
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Planning</h2>
        </div>
        <div className="px-5 py-8 text-sm text-muted-foreground text-center">
          No phases configured. Add phases in Settings → Phases to enable planning.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3.5 border-b">
        <h2 className="font-medium">Planning</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Phase schedule per room group. Edit dates in the table below.
        </p>
      </div>
      <div className="px-5 py-4">
        <ProjectGantt
          projectStart={projectStart}
          projectEnd={projectEnd}
          groups={groups}
          phasePlans={plans}
          phases={phases}
        />
      </div>
      <div className="border-t">
        <PhasePlanTable
          plans={plans}
          phases={phases}
          groups={groups}
          onUpdate={setPlans}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire into project detail page**

In `components/projects/project-detail-client.tsx`, add import:

```typescript
import { PlanningSection } from "@/components/projects/planning-section";
```

Add the planning section into the JSX, after the Room Groups section and before the Rooms section:

```tsx
{/* Planning */}
<section className="lg:col-span-5">
  <PlanningSection
    projectId={project.id}
    projectStart={project.start_date}
    projectEnd={project.estimated_completion_date}
    phases={phases}
    groups={roomGroups}
  />
</section>
```

- [ ] **Step 3: Verify in browser**

Navigate to a project detail page. Verify:
- Planning section appears
- If no phase plans exist, auto-fill runs and creates them
- Gantt shows coloured phase bars
- Table shows editable date pickers
- Changing a date in the table updates the Gantt

- [ ] **Step 4: Commit**

```bash
git add components/projects/planning-section.tsx components/projects/project-detail-client.tsx
git commit -m "feat: add PlanningSection with auto-fill, Gantt, and date table editor"
```

---

### Task 8: Year plan Gantt — expandable room group rows

**Files:**
- Modify: `app/(app)/plan/page.tsx`
- Modify: `components/plan/year-plan-view.tsx`

- [ ] **Step 1: Update plan page data fetching**

In `app/(app)/plan/page.tsx`, expand the `Promise.all` to fetch room groups, phase plans, and the user's `show_room_groups` preference:

Add to the existing parallel fetch:
```typescript
supabase.from("room_groups").select("id, project_id, name, sort_order").order("sort_order"),
supabase.from("phase_plans").select("id, room_group_id, project_id, phase_id, start_date, end_date"),
supabase.from("profiles").select("show_room_groups").eq("id", user!.id).single(),
```

Destructure as `{ data: roomGroups }`, `{ data: phasePlans }`, `{ data: userPrefs }`.

Pass new props to `YearPlanView`:
```tsx
<YearPlanView
  year={year}
  initialView={view}
  projects={projects || []}
  phases={phases || []}
  roomGroups={roomGroups || []}
  phasePlans={(phasePlans || []) as PhasePlan[]}
  showRoomGroups={userPrefs?.show_room_groups ?? true}
/>
```

- [ ] **Step 2: Update YearPlanView props and add expand/collapse state**

In `components/plan/year-plan-view.tsx`, update the Props interface:

```typescript
import type { Project, Phase, RoomGroup, PhasePlan } from "@/lib/types";

interface Props {
  year: number;
  initialView: "gantt" | "calendar";
  projects: Project[];
  phases: Phase[];
  roomGroups: RoomGroup[];
  phasePlans: PhasePlan[];
  showRoomGroups: boolean;
}
```

Update the component signature and add state:

```typescript
export function YearPlanView({ year, initialView, projects, phases, roomGroups, phasePlans, showRoomGroups }: Props) {
```

Add state for expanded projects:
```typescript
const [expanded, setExpanded] = useState<Set<string>>(new Set());
```

Add helper maps:
```typescript
const groupsByProject = useMemo(() => {
  const map = new Map<string, RoomGroup[]>();
  roomGroups.forEach((g) => {
    const list = map.get(g.project_id) || [];
    list.push(g);
    map.set(g.project_id, list);
  });
  return map;
}, [roomGroups]);

const plansByGroup = useMemo(() => {
  const map = new Map<string, PhasePlan[]>();
  phasePlans.forEach((pp) => {
    const key = pp.room_group_id || pp.project_id || "";
    const list = map.get(key) || [];
    list.push(pp);
    map.set(key, list);
  });
  return map;
}, [phasePlans]);
```

Add toggle function:
```typescript
function toggleExpand(projectId: string) {
  setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(projectId)) next.delete(projectId);
    else next.add(projectId);
    return next;
  });
}
```

- [ ] **Step 3: Update height calculation to be dynamic**

Replace the fixed height calculation with a dynamic one:

```typescript
const SUB_ROW_H = 28;

const rowOffsets = useMemo(() => {
  const offsets: number[] = [];
  let y = HEADER_H;
  projects.forEach((p) => {
    offsets.push(y);
    y += ROW_H;
    if (showRoomGroups && expanded.has(p.id)) {
      const groups = groupsByProject.get(p.id) || [];
      y += groups.length * SUB_ROW_H;
    }
  });
  return offsets;
}, [projects, expanded, showRoomGroups, groupsByProject]);

const height = (rowOffsets.length > 0 ? rowOffsets[rowOffsets.length - 1] + ROW_H : HEADER_H) +
  (showRoomGroups && projects.length > 0 && expanded.has(projects[projects.length - 1].id)
    ? (groupsByProject.get(projects[projects.length - 1].id)?.length || 0) * SUB_ROW_H
    : 0);
```

- [ ] **Step 4: Update desktop SVG rendering to use dynamic offsets and render sub-rows**

Replace the project rendering block in the desktop SVG (the `projects.map(...)` block) with:

```tsx
{projects.map((p, i) => {
  const start = max([parseISO(p.start_date), yearStart]);
  const end = min([parseISO(p.estimated_completion_date), yearEnd]);
  const x = LABEL_W + (differenceInDays(start, yearStart) * dayW);
  const w = Math.max(2, (differenceInDays(end, start) + 1) * dayW);
  const rowY = rowOffsets[i];
  const y = rowY + 8;
  const phase = p.current_phase_id ? phaseMap.get(p.current_phase_id) : null;
  const color = phase?.color || "#94a3b8";
  const projGroups = groupsByProject.get(p.id) || [];
  const isExpanded = showRoomGroups && expanded.has(p.id);
  const hasGroups = showRoomGroups && projGroups.length > 0;

  return (
    <g key={p.id}>
      <line x1={0} y1={rowY} x2={LABEL_W + TIMELINE_W} y2={rowY} stroke="hsl(var(--border))" strokeWidth={0.5} />
      {/* Expand chevron */}
      {hasGroups && (
        <g onClick={() => toggleExpand(p.id)} className="cursor-pointer">
          <text x={4} y={rowY + 22} fontSize={10} className="fill-muted-foreground">
            {isExpanded ? "▼" : "▶"}
          </text>
        </g>
      )}
      <text x={hasGroups ? 16 : 12} y={rowY + 22} fontSize={12} className="fill-foreground" fontWeight={500}>
        {p.name.length > truncLen ? p.name.slice(0, truncLen) + "…" : p.name}
      </text>
      {p.client_name && LABEL_W > 160 && (
        <text x={hasGroups ? 16 : 12} y={rowY + 22} fontSize={10} className="fill-muted-foreground" textAnchor="start" dx={Math.min(160, p.name.length * 6.5 + 8)}>
          {p.client_name.length > 16 ? p.client_name.slice(0, 16) + "…" : p.client_name}
        </text>
      )}
      <a href={`/projects/${p.id}`}>
        <rect x={x} y={y} width={w} height={20} rx={4} fill={color} fillOpacity={0.85} className="hover:fill-opacity-100 cursor-pointer" />
        <line x1={x + w} y1={y - 2} x2={x + w} y2={y + 22} stroke={color} strokeWidth={2} />
      </a>

      {/* Sub-rows for room groups */}
      {isExpanded && projGroups.map((g, gi) => {
        const subY = rowY + ROW_H + gi * SUB_ROW_H;
        const groupPlans = plansByGroup.get(g.id) || [];
        // Overall span: earliest start to latest end
        const groupStart = groupPlans.reduce((min, pp) => pp.start_date < min ? pp.start_date : min, groupPlans[0]?.start_date || p.start_date);
        const groupEnd = groupPlans.reduce((max, pp) => pp.end_date > max ? pp.end_date : max, groupPlans[0]?.end_date || p.estimated_completion_date);
        const gStart = max([parseISO(groupStart), yearStart]);
        const gEnd = min([parseISO(groupEnd), yearEnd]);
        const gx = LABEL_W + differenceInDays(gStart, yearStart) * dayW;
        const gw = Math.max(2, (differenceInDays(gEnd, gStart) + 1) * dayW);
        // Use first phase's color as representative
        const firstPlan = groupPlans.sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
        const gColor = firstPlan ? (phaseMap.get(firstPlan.phase_id)?.color || "#94a3b8") : "#94a3b8";

        return (
          <g key={g.id}>
            <line x1={0} y1={subY} x2={LABEL_W + TIMELINE_W} y2={subY} stroke="hsl(var(--border))" strokeWidth={0.3} strokeDasharray="2 2" />
            <text x={28} y={subY + 18} fontSize={10} className="fill-muted-foreground">
              {g.name.length > (truncLen - 2) ? g.name.slice(0, truncLen - 2) + "…" : g.name}
            </text>
            <rect x={gx} y={subY + 4} width={gw} height={16} rx={3} fill={gColor} fillOpacity={0.6} />
          </g>
        );
      })}
    </g>
  );
})}
```

- [ ] **Step 5: Update mobile rendering similarly**

Apply the same expand/collapse pattern to the mobile label column and timeline SVG:

In the label column, replace the project label mapping:
```tsx
{projects.map((p, i) => {
  const projGroups = groupsByProject.get(p.id) || [];
  const isExpanded = showRoomGroups && expanded.has(p.id);
  const hasGroups = showRoomGroups && projGroups.length > 0;
  return (
    <div key={p.id}>
      <div
        className="border-b px-2 flex items-center gap-1 text-[11px] font-medium truncate"
        style={{ height: ROW_H }}
        onClick={hasGroups ? () => toggleExpand(p.id) : undefined}
      >
        {hasGroups && <span className="text-[9px] text-muted-foreground shrink-0">{isExpanded ? "▼" : "▶"}</span>}
        <Link href={`/projects/${p.id}`} className="truncate hover:underline">
          {p.name.length > truncLen ? p.name.slice(0, truncLen) + "…" : p.name}
        </Link>
      </div>
      {isExpanded && projGroups.map((g) => (
        <div key={g.id} className="border-b px-2 pl-4 flex items-center text-[10px] text-muted-foreground truncate" style={{ height: SUB_ROW_H }}>
          {g.name.length > (truncLen - 2) ? g.name.slice(0, truncLen - 2) + "…" : g.name}
        </div>
      ))}
    </div>
  );
})}
```

In the mobile timeline SVG, use `rowOffsets` for y positions and render sub-bars using the same pattern as desktop but without `LABEL_W` offset.

- [ ] **Step 6: Verify in browser**

Navigate to the year plan page. Verify:
- Projects that have room groups show a ▶ chevron
- Clicking expands to show group sub-bars
- Clicking again collapses
- Sub-bars are indented and smaller
- SVG height adjusts dynamically

- [ ] **Step 7: Commit**

```bash
git add app/(app)/plan/page.tsx components/plan/year-plan-view.tsx
git commit -m "feat: add expandable room group sub-bars to year plan Gantt"
```

---

### Task 9: Task assignment to room groups

**Files:**
- Modify: `components/projects/project-detail-client.tsx`
- Modify: `components/mobile-fab-drawer.tsx`

- [ ] **Step 1: Add room group picker to project detail task form**

In `components/projects/project-detail-client.tsx`, add state:

```typescript
const [newTaskRoomGroup, setNewTaskRoomGroup] = useState<string>("");
```

In the `addTask` function, include `room_group_id` in the insert:

```typescript
room_group_id: newTaskRoomGroup || null,
```

In the task form JSX (the `<div className="flex gap-2">` around line 485), add a room group picker before the room picker:

```tsx
<select
  value={newTaskRoomGroup}
  onChange={(e) => setNewTaskRoomGroup(e.target.value)}
  className="flex-1 h-8 px-2 text-xs rounded-md border bg-background"
>
  <option value="">No group</option>
  {roomGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
</select>
```

- [ ] **Step 2: Show room group badge on task rows**

In the task row rendering (around line 466), add the group name badge:

```tsx
{task.room_group_id && (() => {
  const group = roomGroups.find((g) => g.id === task.room_group_id);
  return group ? <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{group.name}</span> : null;
})()}
```

- [ ] **Step 3: Add room group picker to mobile FAB task form**

In `components/mobile-fab-drawer.tsx`, add state:

```typescript
const [taskRoomGroupId, setTaskRoomGroupId] = useState("");
```

Fetch room groups when a project is selected. Add to the existing project-change effect or inline:

```typescript
const [roomGroups, setRoomGroups] = useState<{ id: string; name: string }[]>([]);
```

When `taskProjectId` changes, fetch groups:
```typescript
useEffect(() => {
  if (!taskProjectId) { setRoomGroups([]); return; }
  const supabase = createClient();
  supabase.from("room_groups").select("id, name").eq("project_id", taskProjectId).order("sort_order")
    .then(({ data }) => setRoomGroups(data || []));
}, [taskProjectId]);
```

Add the picker in the task form (in the two-column grid), before the assignee select:

```tsx
{roomGroups.length > 0 && (
  <select
    value={taskRoomGroupId}
    onChange={(e) => setTaskRoomGroupId(e.target.value)}
    className="h-9 px-2 text-sm rounded-md border bg-background"
  >
    <option value="">No group</option>
    {roomGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
  </select>
)}
```

Include `room_group_id: taskRoomGroupId || null` in the task insert.

- [ ] **Step 4: Verify in browser**

- On project detail: create a task with a room group selected. Verify badge shows.
- On mobile FAB: select a project, verify room group picker appears, create a task.

- [ ] **Step 5: Commit**

```bash
git add components/projects/project-detail-client.tsx components/mobile-fab-drawer.tsx
git commit -m "feat: add room group picker to task creation forms"
```

---

### Task 10: Settings toggle + profile form update

**Files:**
- Modify: `components/settings/profile-form.tsx`
- Modify: `app/(app)/settings/profile/page.tsx`

- [ ] **Step 1: Update profile page to fetch show_room_groups**

In `app/(app)/settings/profile/page.tsx`, update the select to include `show_room_groups`:

```typescript
.select("full_name, avatar_url, theme_preference, density_preference, show_room_groups")
```

Pass the new prop:
```tsx
<ProfileForm
  userId={user!.id}
  email={user!.email || ""}
  fullName={profile?.full_name || ""}
  avatarUrl={profile?.avatar_url || null}
  themePref={profile?.theme_preference || "system"}
  densityPref={profile?.density_preference || "comfortable"}
  showRoomGroupsPref={profile?.show_room_groups ?? true}
/>
```

- [ ] **Step 2: Update ProfileForm to include the toggle**

In `components/settings/profile-form.tsx`, add to the interface:

```typescript
  showRoomGroupsPref: boolean;
```

Add to the component signature and state:

```typescript
showRoomGroupsPref: initialShowRoomGroups,
```

```typescript
const [showRoomGroups, setShowRoomGroups] = useState(initialShowRoomGroups);
```

Add the handler:

```typescript
function handleShowRoomGroupsChange(value: boolean) {
  setShowRoomGroups(value);
  supabase.from("profiles").update({ show_room_groups: value }).eq("id", userId);
}
```

Add the toggle in the Appearance section, after the density toggle (after the density description paragraph):

```tsx
{/* Room groups on year plan */}
<div>
  <label className="block text-sm font-medium mb-2">Year plan detail</label>
  <div className="inline-flex items-center rounded-md border p-0.5">
    {([true, false] as const).map((opt) => (
      <button
        key={String(opt)}
        type="button"
        onClick={() => handleShowRoomGroupsChange(opt)}
        className={`h-8 px-3 text-xs rounded font-medium transition-colors ${
          showRoomGroups === opt
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted"
        }`}
      >
        {opt ? "Show groups" : "Projects only"}
      </button>
    ))}
  </div>
  <p className="text-xs text-muted-foreground mt-1.5">Show room group sub-bars on the year plan Gantt.</p>
</div>
```

- [ ] **Step 3: Verify in browser**

Navigate to Settings → Profile. Verify the "Year plan detail" toggle appears in the Appearance section. Toggle it and verify the preference saves.

- [ ] **Step 4: Commit**

```bash
git add components/settings/profile-form.tsx app/(app)/settings/profile/page.tsx
git commit -m "feat: add show room groups toggle to profile appearance settings"
```

---

### Task 11: Final build verification

**Files:** none (verification only)

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Production build**

```bash
npm run build
```

Expected: all routes compile successfully.

- [ ] **Step 3: Visual verification**

Using Claude Preview or browser, verify:
- Project detail page: room groups section, room group picker on rooms, planning section with Gantt + table
- Year plan: expand/collapse on projects with groups
- Task forms: room group picker visible when project selected
- Settings: show room groups toggle in appearance section

- [ ] **Step 4: Commit any fixes**

If any issues found, fix and commit.

