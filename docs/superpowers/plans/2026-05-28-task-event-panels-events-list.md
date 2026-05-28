# Task & Event Slide Panels + Events List View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add slide-out detail panels for tasks and events, plus an events list view in the year plan.

**Architecture:** One shared `SlidePanel` wrapper component handles animation, backdrop, and responsive direction (right slide on desktop, bottom sheet on mobile). Task and event panels render their own form content inside it. A new `EventsListView` component provides a third year plan view toggle. No new database migrations — all fields already exist.

**Tech Stack:** Next.js 15.3 (App Router), React 19, TypeScript, Tailwind CSS, Supabase, Lucide icons, date-fns

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `components/ui/slide-panel.tsx` | Shared slide-out panel wrapper (animation, backdrop, header, responsive) |
| Create | `components/tasks/task-detail-panel.tsx` | Task detail form content (title, notes, due date, assignee) |
| Modify | `components/tasks/tasks-client.tsx` | Add onClick handlers to open task panel |
| Create | `components/plan/event-detail-panel.tsx` | Event detail form content (title, date, type, project, room group, notes) |
| Create | `components/plan/events-list-view.tsx` | Events list view with month-grouped cards |
| Modify | `components/plan/year-plan-view.tsx` | Add event click handlers in calendar, add Events view toggle, render EventsListView |
| Modify | `app/(app)/plan/page.tsx` | Accept "events" as valid view param |

---

### Task 1: Create shared SlidePanel component

**Files:**
- Create: `components/ui/slide-panel.tsx`

This is the reusable wrapper used by both task and event panels. Desktop: slides from right. Mobile (<768px): bottom sheet from bottom.

- [ ] **Step 1: Create the SlidePanel component**

Create `components/ui/slide-panel.tsx`:

```tsx
"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { X, Trash2 } from "lucide-react";

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  onDelete?: () => void;
  children: React.ReactNode;
}

export function SlidePanel({ open, onClose, title, onDelete, children }: SlidePanelProps) {
  const [isMobile, setIsMobile] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // Detect mobile
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  // Mobile drag-to-dismiss handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    setDragOffset(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) setDragOffset(delta); // Only allow dragging down
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragOffset > 100) {
      onClose();
    }
    setDragOffset(0);
    dragStartY.current = null;
  }, [dragOffset, onClose]);

  function handleDelete() {
    if (!onDelete) return;
    if (confirm("Are you sure you want to delete this?")) {
      onDelete();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      {isMobile ? (
        /* ── Mobile: bottom sheet ── */
        <div
          ref={panelRef}
          className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl shadow-lg flex flex-col transition-transform duration-200 ease-out"
          style={{
            maxHeight: "75vh",
            transform: `translateY(${dragOffset}px)`,
          }}
        >
          {/* Drag handle */}
          <div
            className="flex justify-center pt-3 pb-1 cursor-grab"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-9 h-1 bg-muted-foreground/30 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-4 pb-3 pt-1 border-b flex items-center justify-between">
            <span className="text-sm font-semibold">{title}</span>
            <div className="flex items-center gap-2">
              {onDelete && (
                <button
                  onClick={handleDelete}
                  className="h-7 w-7 rounded-md border grid place-items-center text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={13} />
                </button>
              )}
              <button
                onClick={onClose}
                className="h-7 w-7 rounded-md border grid place-items-center text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {children}
          </div>
        </div>
      ) : (
        /* ── Desktop: right slide ── */
        <div
          ref={panelRef}
          className="absolute top-0 right-0 h-full w-[380px] bg-card border-l shadow-lg flex flex-col animate-in slide-in-from-right duration-200"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
            <span className="text-sm font-semibold">{title}</span>
            <div className="flex items-center gap-2">
              {onDelete && (
                <button
                  onClick={handleDelete}
                  className="h-7 w-7 rounded-md border grid place-items-center text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={13} />
                </button>
              )}
              <button
                onClick={onClose}
                className="h-7 w-7 rounded-md border grid place-items-center text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx next lint --file components/ui/slide-panel.tsx`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/ui/slide-panel.tsx
git commit -m "feat: add shared SlidePanel component (right slide desktop, bottom sheet mobile)"
```

---

### Task 2: Create TaskDetailPanel component

**Files:**
- Create: `components/tasks/task-detail-panel.tsx`

This renders the task-specific form content inside the SlidePanel. All fields auto-save with 800ms debounce.

- [ ] **Step 1: Create the TaskDetailPanel component**

Create `components/tasks/task-detail-panel.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { SlidePanel } from "@/components/ui/slide-panel";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  project_id: string | null;
  room_id: string | null;
  assigned_to: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  created_at: string;
  projects: { name: string } | null;
  rooms: { name: string } | null;
  assignee: { full_name: string } | null;
  completer: { full_name: string } | null;
}

interface ProfileOption {
  id: string;
  full_name: string;
}

interface TaskDetailPanelProps {
  task: TaskRow | null;
  profiles: ProfileOption[];
  userId: string;
  onClose: () => void;
  onUpdated: (task: TaskRow) => void;
  onDeleted: (id: string) => void;
  onToggleComplete: (task: TaskRow) => void;
}

export function TaskDetailPanel({
  task, profiles, userId, onClose, onUpdated, onDeleted, onToggleComplete,
}: TaskDetailPanelProps) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when task changes
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description || "");
    setDueDate(task.due_date || "");
    setAssignedTo(task.assigned_to || "");
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save with 800ms debounce
  const autoSave = useCallback(
    (field: string, value: string | null) => {
      if (!task) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        const { data, error } = await supabase
          .from("tasks")
          .update({ [field]: value || null })
          .eq("id", task.id)
          .select("*, projects(name), rooms(name), assignee:assigned_to(full_name), completer:completed_by(full_name)")
          .single();
        if (!error && data) {
          onUpdated(data as TaskRow);
        }
      }, 800);
    },
    [task, supabase, onUpdated],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  async function handleDelete() {
    if (!task) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (!error) {
      onDeleted(task.id);
      onClose();
    }
  }

  if (!task) return null;

  const projectLabel = task.projects
    ? `${task.projects.name}${task.rooms ? ` · ${task.rooms.name}` : ""}`
    : "Personal";

  return (
    <SlidePanel
      open={!!task}
      onClose={onClose}
      title="Task Detail"
      onDelete={handleDelete}
    >
      {/* Checkbox + Title */}
      <div className="flex items-start gap-3 mb-5">
        <input
          type="checkbox"
          checked={!!task.completed_at}
          onChange={() => onToggleComplete(task)}
          className="mt-1 size-[18px] rounded border-input cursor-pointer shrink-0"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            autoSave("title", e.target.value);
          }}
          className="flex-1 text-[15px] font-medium bg-transparent border border-transparent hover:border-border focus:border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Due date */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Due date
        </label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => {
            setDueDate(e.target.value);
            autoSave("due_date", e.target.value);
          }}
          className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Assignee */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Assigned to
        </label>
        <select
          value={assignedTo}
          onChange={(e) => {
            setAssignedTo(e.target.value);
            autoSave("assigned_to", e.target.value);
          }}
          className="w-full h-9 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Unassigned</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name}</option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Notes
        </label>
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            autoSave("description", e.target.value);
          }}
          placeholder="Add notes..."
          rows={4}
          className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {/* Meta footer */}
      <div className="pt-3 border-t text-[11px] text-muted-foreground">
        Created {format(new Date(task.created_at), "MMM d, yyyy")} · {projectLabel}
      </div>
    </SlidePanel>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx next lint --file components/tasks/task-detail-panel.tsx`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/tasks/task-detail-panel.tsx
git commit -m "feat: add TaskDetailPanel with auto-save for title, notes, due date, assignee"
```

---

### Task 3: Wire TaskDetailPanel into tasks page

**Files:**
- Modify: `components/tasks/tasks-client.tsx`
- Modify: `app/(app)/tasks/page.tsx`

Add onClick handlers to task rows/cards that open the panel. Pass profiles and description data through.

- [ ] **Step 1: Update the server page to fetch task descriptions and pass profiles through**

The server page at `app/(app)/tasks/page.tsx` already fetches `profiles` and passes them. However, the task query doesn't include `description` or `created_at` in its select (it uses `*` which does include them, but the `TaskRow` interface in the client doesn't have `description` or `created_at`). We need to update the client interface and add the panel.

Modify `components/tasks/tasks-client.tsx`. Add these changes:

First, add the import for `TaskDetailPanel` and update the `TaskRow` interface to include `description` and `created_at`:

At the top of the file, after the existing imports (line 7), add:
```tsx
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
```

Update the `TaskRow` interface (lines 9-24) to add `description` and `created_at`:
```tsx
interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: number;
  project_id: string | null;
  room_id: string | null;
  assigned_to: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  created_at: string;
  projects: { name: string } | null;
  rooms: { name: string } | null;
  assignee: { full_name: string } | null;
  completer: { full_name: string } | null;
}
```

- [ ] **Step 2: Add panel state and handlers to the TasksClient component**

Inside the `TasksClient` function (after line 58, the `assignee` state), add:

```tsx
const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
```

Add an update handler (after `toggleTask` function, around line 112):

```tsx
function handleTaskUpdated(updated: TaskRow) {
  setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  setSelectedTask(updated);
}

function handleTaskDeleted(id: string) {
  setTasks((prev) => prev.filter((t) => t.id !== id));
  setSelectedTask(null);
}
```

- [ ] **Step 3: Make desktop table rows clickable**

In the desktop table, on the `<tr>` element (line 211), add a click handler and cursor style. Replace:

```tsx
<tr key={t.id} className={`hover:bg-muted/30 ${t.completed_at ? "opacity-50" : ""}`}>
```

with:

```tsx
<tr
  key={t.id}
  className={`hover:bg-muted/30 cursor-pointer ${t.completed_at ? "opacity-50" : ""}`}
  onClick={() => setSelectedTask(t)}
>
```

On the checkbox `<input>` inside the table (line 213-218), add `e.stopPropagation()` to prevent opening the panel when toggling:

```tsx
<input
  type="checkbox"
  checked={!!t.completed_at}
  onChange={() => toggleTask(t)}
  onClick={(e) => e.stopPropagation()}
  className="size-4 rounded border-input cursor-pointer"
/>
```

On the project `<Link>` in the table (line 227), add stopPropagation:

```tsx
<Link
  href={`/projects/${t.project_id}`}
  className="hover:underline"
  onClick={(e) => e.stopPropagation()}
>
  {t.projects.name}
</Link>
```

- [ ] **Step 4: Make mobile cards clickable**

On the mobile card `<div>` (line 254), add a click handler. Replace:

```tsx
<div key={t.id} className={`rounded-lg border bg-card p-3 flex items-start gap-3 ${t.completed_at ? "opacity-50" : ""}`}>
```

with:

```tsx
<div
  key={t.id}
  className={`rounded-lg border bg-card p-3 flex items-start gap-3 cursor-pointer ${t.completed_at ? "opacity-50" : ""}`}
  onClick={() => setSelectedTask(t)}
>
```

On the mobile checkbox (line 255-259), add stopPropagation:

```tsx
<input
  type="checkbox"
  checked={!!t.completed_at}
  onChange={() => toggleTask(t)}
  onClick={(e) => e.stopPropagation()}
  className="mt-0.5 size-4 rounded border-input cursor-pointer shrink-0"
/>
```

On the mobile project `<Link>` (line 267), add stopPropagation:

```tsx
<Link
  href={`/projects/${t.project_id}`}
  className="hover:underline"
  onClick={(e) => e.stopPropagation()}
>
  {t.projects.name}
</Link>
```

- [ ] **Step 5: Render the TaskDetailPanel at the bottom of the component**

At the end of the component's return JSX, just before the closing `</div>` of the container (line 283), add:

```tsx
{/* Task detail panel */}
<TaskDetailPanel
  task={selectedTask}
  profiles={profiles}
  userId={userId}
  onClose={() => setSelectedTask(null)}
  onUpdated={handleTaskUpdated}
  onDeleted={handleTaskDeleted}
  onToggleComplete={(t) => { toggleTask(t); }}
/>
```

- [ ] **Step 6: Verify the tasks page works**

Run: `npm run dev`
Navigate to `/tasks`. Click a task row → panel should slide in from the right. Edit a field → should auto-save. Close → panel should slide away. Test on mobile viewport (resize to <768px) → panel should come from bottom.

- [ ] **Step 7: Commit**

```bash
git add components/tasks/tasks-client.tsx
git commit -m "feat: wire TaskDetailPanel into tasks list — click to open, auto-save, delete"
```

---

### Task 4: Create EventDetailPanel component

**Files:**
- Create: `components/plan/event-detail-panel.tsx`

Event detail form rendered inside SlidePanel. All fields auto-save with 800ms debounce.

- [ ] **Step 1: Create the EventDetailPanel component**

Create `components/plan/event-detail-panel.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { SlidePanel } from "@/components/ui/slide-panel";
import type { CalendarEvent, EventType, Project, RoomGroup } from "@/lib/types";

interface EventDetailPanelProps {
  event: CalendarEvent | null;
  eventTypes: EventType[];
  projects: Project[];
  roomGroups: RoomGroup[];
  groupsByProject: Map<string, RoomGroup[]>;
  onClose: () => void;
  onUpdated: (event: CalendarEvent) => void;
  onDeleted: (id: string) => void;
}

export function EventDetailPanel({
  event, eventTypes, projects, roomGroups, groupsByProject,
  onClose, onUpdated, onDeleted,
}: EventDetailPanelProps) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [typeId, setTypeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [notes, setNotes] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when event changes
  useEffect(() => {
    if (!event) return;
    setTitle(event.title);
    setEventDate(event.event_date);
    setTypeId(event.event_type_id || "");
    setProjectId(event.project_id || "");
    setGroupId(event.room_group_id || "");
    setNotes(event.notes || "");
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const availableGroups = projectId ? (groupsByProject.get(projectId) || []) : [];

  // Get event type color for the dot
  const activeType = typeId ? eventTypes.find((t) => t.id === typeId) : null;
  const dotColor = activeType?.color || "#94a3b8";

  // Auto-save with 800ms debounce
  const autoSave = useCallback(
    (updates: Record<string, string | null>) => {
      if (!event) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        const { data, error } = await supabase
          .from("calendar_events")
          .update(updates)
          .eq("id", event.id)
          .select("*")
          .single();
        if (!error && data) {
          onUpdated(data as CalendarEvent);
        }
      }, 800);
    },
    [event, supabase, onUpdated],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  async function handleDelete() {
    if (!event) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", event.id);
    if (!error) {
      onDeleted(event.id);
      onClose();
    }
  }

  if (!event) return null;

  return (
    <SlidePanel
      open={!!event}
      onClose={onClose}
      title="Event Detail"
      onDelete={handleDelete}
    >
      {/* Color dot + Title */}
      <div className="flex items-start gap-3 mb-5">
        <div
          className="w-3 h-3 rounded-full mt-1.5 shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            autoSave({ title: e.target.value });
          }}
          className="flex-1 text-[15px] font-medium bg-transparent border border-transparent hover:border-border focus:border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Date */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Date
        </label>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => {
            setEventDate(e.target.value);
            autoSave({ event_date: e.target.value });
          }}
          className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Event type */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Event type
        </label>
        <select
          value={typeId}
          onChange={(e) => {
            setTypeId(e.target.value);
            autoSave({ event_type_id: e.target.value || null });
          }}
          className="w-full h-9 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">None</option>
          {eventTypes.filter((t) => !t.archived_at).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Project */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Project
        </label>
        <select
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setGroupId(""); // Clear room group when project changes
            autoSave({ project_id: e.target.value || null, room_group_id: null });
          }}
          className="w-full h-9 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">None</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Room group (conditional) */}
      {projectId && availableGroups.length > 0 && (
        <div className="mb-4">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Room group
          </label>
          <select
            value={groupId}
            onChange={(e) => {
              setGroupId(e.target.value);
              autoSave({ room_group_id: e.target.value || null });
            }}
            className="w-full h-9 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">None</option>
            {availableGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            autoSave({ notes: e.target.value || null });
          }}
          placeholder="Add notes..."
          rows={4}
          className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {/* Meta footer */}
      <div className="pt-3 border-t text-[11px] text-muted-foreground">
        Created {format(new Date(event.created_at), "MMM d, yyyy")}
      </div>
    </SlidePanel>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx next lint --file components/plan/event-detail-panel.tsx`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/plan/event-detail-panel.tsx
git commit -m "feat: add EventDetailPanel with auto-save for all event fields"
```

---

### Task 5: Wire EventDetailPanel into calendar view

**Files:**
- Modify: `components/plan/year-plan-view.tsx`

Add click handlers on event chips in the calendar MonthCard. Render the EventDetailPanel in CalendarView.

- [ ] **Step 1: Add import for EventDetailPanel**

At the top of `components/plan/year-plan-view.tsx`, after the existing imports (around line 12), add:

```tsx
import { EventDetailPanel } from "@/components/plan/event-detail-panel";
```

- [ ] **Step 2: Add event selection state and update handler to CalendarView**

Inside the `CalendarView` function (after line 473 — the `quickAdd` state), add:

```tsx
const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

function handleEventUpdated(updated: CalendarEvent) {
  // Update in parent events array
  const idx = events.findIndex((e) => e.id === updated.id);
  if (idx >= 0) {
    const next = [...events];
    next[idx] = updated;
    // We need a way to update events in the parent. Use onEventAdded pattern:
    // Actually, we need a new callback. Let's use direct state since events is already in CalendarView scope.
    // But events comes from props. We need to add an onEventUpdated callback.
  }
  setSelectedEvent(updated);
}
```

Wait — `events` in CalendarView is a prop, not local state. The parent `YearPlanView` manages events state. So we need to:

1. Add `onEventUpdated` callback to CalendarView props
2. Pass it from YearPlanView

In `YearPlanView` (around line 138-142), where CalendarView is rendered, update the call to also pass an `onEventUpdated` prop. Replace:

```tsx
<CalendarView year={year} projects={projects} phaseMap={phaseMap} scrollTrigger={scrollTrigger}
  events={events} eventTypeMap={eventTypeMap} eventTypes={eventTypes}
  roomGroups={roomGroups} groupsByProject={groupsByProject}
  onEventAdded={(e) => setEvents((prev) => [...prev, e])}
  onEventDeleted={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))} />
```

with:

```tsx
<CalendarView year={year} projects={projects} phaseMap={phaseMap} scrollTrigger={scrollTrigger}
  events={events} eventTypeMap={eventTypeMap} eventTypes={eventTypes}
  roomGroups={roomGroups} groupsByProject={groupsByProject}
  onEventAdded={(e) => setEvents((prev) => [...prev, e])}
  onEventUpdated={(updated) => setEvents((prev) => prev.map((e) => e.id === updated.id ? updated : e))}
  onEventDeleted={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))} />
```

Update the CalendarView function signature (around line 461-470) to add the new prop:

```tsx
function CalendarView({
  year, projects, phaseMap, scrollTrigger,
  events, eventTypeMap, eventTypes, roomGroups, groupsByProject,
  onEventAdded, onEventUpdated, onEventDeleted,
}: {
  year: number; projects: Project[]; phaseMap: Map<string, Phase>; scrollTrigger: number;
  events: CalendarEvent[]; eventTypeMap: Map<string, EventType>; eventTypes: EventType[];
  roomGroups: RoomGroup[]; groupsByProject: Map<string, RoomGroup[]>;
  onEventAdded: (e: CalendarEvent) => void;
  onEventUpdated: (e: CalendarEvent) => void;
  onEventDeleted: (id: string) => void;
}) {
```

- [ ] **Step 3: Add selection state and panel to CalendarView**

Inside `CalendarView`, after the `quickAdd` state (line 473), add:

```tsx
const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
```

Add an `onEventClick` handler to the `MonthCard` component. Update the MonthCard render (around lines 541-552). Replace:

```tsx
<MonthCard
  key={m.toISOString()}
  ref={i === todayMonthIndex ? todayMonthRef : undefined}
  month={m}
  byDate={byDate}
  eventsByDate={eventsByDate}
  eventTypeMap={eventTypeMap}
  phaseMap={phaseMap}
  isCurrentMonth={i === todayMonthIndex}
  onDayClick={(date) => setQuickAdd({ date })}
  onDeleteEvent={onEventDeleted}
/>
```

with:

```tsx
<MonthCard
  key={m.toISOString()}
  ref={i === todayMonthIndex ? todayMonthRef : undefined}
  month={m}
  byDate={byDate}
  eventsByDate={eventsByDate}
  eventTypeMap={eventTypeMap}
  phaseMap={phaseMap}
  isCurrentMonth={i === todayMonthIndex}
  onDayClick={(date) => setQuickAdd({ date })}
  onEventClick={(ev) => setSelectedEvent(ev)}
  onDeleteEvent={onEventDeleted}
/>
```

At the bottom of CalendarView's return JSX (just before the closing `</div>` of the `space-y-4` wrapper, around line 555), add:

```tsx
{/* Event detail panel */}
<EventDetailPanel
  event={selectedEvent}
  eventTypes={eventTypes}
  projects={projects}
  roomGroups={roomGroups}
  groupsByProject={groupsByProject}
  onClose={() => setSelectedEvent(null)}
  onUpdated={(updated) => {
    onEventUpdated(updated);
    setSelectedEvent(updated);
  }}
  onDeleted={(id) => {
    onEventDeleted(id);
    setSelectedEvent(null);
  }}
/>
```

- [ ] **Step 4: Update MonthCard to support onEventClick**

Update the MonthCard props interface (around line 710) to add `onEventClick`:

```tsx
const MonthCard = forwardRef<HTMLDivElement, {
  month: Date;
  byDate: Map<string, Project[]>;
  eventsByDate: Map<string, CalendarEvent[]>;
  eventTypeMap: Map<string, EventType>;
  phaseMap: Map<string, Phase>;
  isCurrentMonth?: boolean;
  onDayClick: (date: string) => void;
  onEventClick: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
}>(function MonthCard({ month, byDate, eventsByDate, eventTypeMap, phaseMap, isCurrentMonth, onDayClick, onEventClick, onDeleteEvent }, ref) {
```

In the event chip rendering (around lines 800-816), make the event chip clickable. Replace:

```tsx
<div
  key={ev.id}
  className="mt-0.5 truncate rounded px-1 py-0.5 text-[10px] flex items-center gap-0.5 group/ev"
  style={{ backgroundColor: `${color}20`, color }}
  title={`${ev.title}${et ? ` (${et.name})` : ""}`}
>
```

with:

```tsx
<div
  key={ev.id}
  className="mt-0.5 truncate rounded px-1 py-0.5 text-[10px] flex items-center gap-0.5 group/ev cursor-pointer hover:opacity-80"
  style={{ backgroundColor: `${color}20`, color }}
  title={`${ev.title}${et ? ` (${et.name})` : ""}`}
  onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
>
```

- [ ] **Step 5: Verify the calendar event click works**

Run: `npm run dev`
Navigate to `/plan?view=calendar`. Click on an event chip → panel should slide in from the right. Edit the title → should auto-save. Delete → event removed from calendar. Close panel → panel slides away.

- [ ] **Step 6: Commit**

```bash
git add components/plan/year-plan-view.tsx
git commit -m "feat: wire EventDetailPanel into calendar — click event chip to open/edit/delete"
```

---

### Task 6: Create EventsListView component

**Files:**
- Create: `components/plan/events-list-view.tsx`

A chronological card list of all events grouped by month. Click a card → opens EventDetailPanel.

- [ ] **Step 1: Create the EventsListView component**

Create `components/plan/events-list-view.tsx`:

```tsx
"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import type { CalendarEvent, EventType, Project, RoomGroup } from "@/lib/types";
import { EventDetailPanel } from "@/components/plan/event-detail-panel";

interface EventsListViewProps {
  year: number;
  events: CalendarEvent[];
  eventTypes: EventType[];
  eventTypeMap: Map<string, EventType>;
  projects: Project[];
  roomGroups: RoomGroup[];
  groupsByProject: Map<string, RoomGroup[]>;
  onEventUpdated: (event: CalendarEvent) => void;
  onEventDeleted: (id: string) => void;
}

interface MonthGroup {
  key: string;       // "2026-05"
  label: string;     // "May 2026"
  events: CalendarEvent[];
}

export function EventsListView({
  year, events, eventTypes, eventTypeMap, projects, roomGroups, groupsByProject,
  onEventUpdated, onEventDeleted,
}: EventsListViewProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const currentMonthRef = useRef<HTMLDivElement>(null);

  // Group events by month
  const monthGroups = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const date = parseISO(ev.event_date);
      const key = format(date, "yyyy-MM");
      const arr = groups.get(key) || [];
      arr.push(ev);
      groups.set(key, arr);
    }

    const result: MonthGroup[] = [];
    groups.forEach((evts, key) => {
      const date = parseISO(key + "-01");
      result.push({
        key,
        label: format(date, "MMMM yyyy"),
        events: evts.sort((a, b) => a.event_date.localeCompare(b.event_date)),
      });
    });
    result.sort((a, b) => a.key.localeCompare(b.key));
    return result;
  }, [events]);

  // Determine current month key for auto-scroll
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    if (now.getFullYear() !== year) return null;
    return format(now, "yyyy-MM");
  }, [year]);

  // Auto-scroll to current month on mount
  useEffect(() => {
    if (!currentMonthRef.current) return;
    const timer = setTimeout(() => {
      if (!currentMonthRef.current) return;
      const rect = currentMonthRef.current.getBoundingClientRect();
      const scrollTop = window.scrollY + rect.top - 80;
      window.scrollTo({ top: Math.max(0, scrollTop), behavior: "instant" });
    }, 100);
    return () => clearTimeout(timer);
  }, [year]);

  // Build project lookup for display
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const roomGroupMap = useMemo(() => new Map(roomGroups.map((g) => [g.id, g])), [roomGroups]);

  if (monthGroups.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">No events for {year}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {monthGroups.map((group) => (
        <div
          key={group.key}
          ref={group.key === currentMonthKey ? currentMonthRef : undefined}
        >
          {/* Month header */}
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 pb-2 border-b">
            {group.label}
          </div>

          {/* Event cards */}
          <div className="space-y-2">
            {group.events.map((ev) => {
              const et = ev.event_type_id ? eventTypeMap.get(ev.event_type_id) : null;
              const color = et?.color || "#94a3b8";
              const project = ev.project_id ? projectMap.get(ev.project_id) : null;
              const roomGroup = ev.room_group_id ? roomGroupMap.get(ev.room_group_id) : null;
              const date = parseISO(ev.event_date);

              return (
                <div
                  key={ev.id}
                  className="flex items-start gap-3 px-4 py-3 border rounded-lg bg-card cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedEvent(ev)}
                >
                  {/* Color dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: color }}
                  />

                  {/* Title + project */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{ev.title}</div>
                    {project && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {project.name}
                        {roomGroup && ` · ${roomGroup.name}`}
                      </div>
                    )}
                  </div>

                  {/* Date + type badge */}
                  <div className="text-right shrink-0">
                    <div className="text-[13px] font-medium">
                      {format(date, "EEE d")}
                    </div>
                    {et && (
                      <span
                        className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{
                          backgroundColor: `${color}20`,
                          color,
                        }}
                      >
                        {et.name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Event detail panel */}
      <EventDetailPanel
        event={selectedEvent}
        eventTypes={eventTypes}
        projects={projects}
        roomGroups={roomGroups}
        groupsByProject={groupsByProject}
        onClose={() => setSelectedEvent(null)}
        onUpdated={(updated) => {
          onEventUpdated(updated);
          setSelectedEvent(updated);
        }}
        onDeleted={(id) => {
          onEventDeleted(id);
          setSelectedEvent(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx next lint --file components/plan/events-list-view.tsx`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/plan/events-list-view.tsx
git commit -m "feat: add EventsListView — month-grouped chronological event cards"
```

---

### Task 7: Add Events view toggle to year plan

**Files:**
- Modify: `components/plan/year-plan-view.tsx`
- Modify: `app/(app)/plan/page.tsx`

Add "Events" as a third view toggle alongside Gantt and Calendar. Wire up the EventsListView component.

- [ ] **Step 1: Update the plan page to accept "events" view param**

In `app/(app)/plan/page.tsx`, update line 14 to accept "events":

Replace:
```tsx
const view = (params.view === "calendar" ? "calendar" : "gantt") as "gantt" | "calendar";
```

with:
```tsx
const view = (["calendar", "events"].includes(params.view || "") ? params.view : "gantt") as "gantt" | "calendar" | "events";
```

- [ ] **Step 2: Update YearPlanView Props interface and view state**

In `components/plan/year-plan-view.tsx`, update the `Props` interface (line 17):

Replace:
```tsx
initialView: "gantt" | "calendar";
```

with:
```tsx
initialView: "gantt" | "calendar" | "events";
```

Add the import for EventsListView at the top of the file (after the EventDetailPanel import):

```tsx
import { EventsListView } from "@/components/plan/events-list-view";
```

- [ ] **Step 3: Add the Events toggle button**

In the view toggle button group (around lines 108-116), add the Events button. Replace:

```tsx
<div className="flex items-center rounded-md border p-0.5">
  <button
    onClick={() => { setView("gantt"); setQuery({ view: "gantt" }); }}
    className={`h-7 px-3 text-xs rounded ${view === "gantt" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
  >Gantt</button>
  <button
    onClick={() => { setView("calendar"); setQuery({ view: "calendar" }); }}
    className={`h-7 px-3 text-xs rounded ${view === "calendar" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
  >Calendar</button>
</div>
```

with:

```tsx
<div className="flex items-center rounded-md border p-0.5">
  <button
    onClick={() => { setView("gantt"); setQuery({ view: "gantt" }); }}
    className={`h-7 px-3 text-xs rounded ${view === "gantt" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
  >Gantt</button>
  <button
    onClick={() => { setView("calendar"); setQuery({ view: "calendar" }); }}
    className={`h-7 px-3 text-xs rounded ${view === "calendar" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
  >Calendar</button>
  <button
    onClick={() => { setView("events"); setQuery({ view: "events" }); }}
    className={`h-7 px-3 text-xs rounded ${view === "events" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
  >Events</button>
</div>
```

- [ ] **Step 4: Render EventsListView for the events view**

Update the conditional rendering block (around lines 133-143). Replace:

```tsx
) : view === "gantt" ? (
  <GanttView year={year} projects={projects} phaseMap={phaseMap} scrollTrigger={scrollTrigger}
    showRoomGroups={showRoomGroups} expanded={expanded} toggleExpand={toggleExpand}
    groupsByProject={groupsByProject} plansByGroup={plansByGroup} />
) : (
  <CalendarView year={year} projects={projects} phaseMap={phaseMap} scrollTrigger={scrollTrigger}
    events={events} eventTypeMap={eventTypeMap} eventTypes={eventTypes}
    roomGroups={roomGroups} groupsByProject={groupsByProject}
    onEventAdded={(e) => setEvents((prev) => [...prev, e])}
    onEventUpdated={(updated) => setEvents((prev) => prev.map((e) => e.id === updated.id ? updated : e))}
    onEventDeleted={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))} />
)}
```

with:

```tsx
) : view === "gantt" ? (
  <GanttView year={year} projects={projects} phaseMap={phaseMap} scrollTrigger={scrollTrigger}
    showRoomGroups={showRoomGroups} expanded={expanded} toggleExpand={toggleExpand}
    groupsByProject={groupsByProject} plansByGroup={plansByGroup} />
) : view === "calendar" ? (
  <CalendarView year={year} projects={projects} phaseMap={phaseMap} scrollTrigger={scrollTrigger}
    events={events} eventTypeMap={eventTypeMap} eventTypes={eventTypes}
    roomGroups={roomGroups} groupsByProject={groupsByProject}
    onEventAdded={(e) => setEvents((prev) => [...prev, e])}
    onEventUpdated={(updated) => setEvents((prev) => prev.map((e) => e.id === updated.id ? updated : e))}
    onEventDeleted={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))} />
) : (
  <EventsListView
    year={year}
    events={events}
    eventTypes={eventTypes}
    eventTypeMap={eventTypeMap}
    projects={projects}
    roomGroups={roomGroups}
    groupsByProject={groupsByProject}
    onEventUpdated={(updated) => setEvents((prev) => prev.map((e) => e.id === updated.id ? updated : e))}
    onEventDeleted={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))}
  />
)}
```

- [ ] **Step 5: Verify all three views work**

Run: `npm run dev`

Test each view:
1. Navigate to `/plan` → Gantt view (default)
2. Click "Calendar" toggle → Calendar view, click an event → panel opens
3. Click "Events" toggle → Events list view with cards grouped by month, click a card → panel opens
4. Navigate with ‹/› year arrows → all three views update
5. Click "Today" → scrolls to current month in calendar and events list

- [ ] **Step 6: Commit**

```bash
git add components/plan/year-plan-view.tsx components/plan/events-list-view.tsx app/(app)/plan/page.tsx
git commit -m "feat: add Events list view as third year plan toggle (Gantt | Calendar | Events)"
```

---

## Verification Checklist

After all tasks are complete, verify the full feature set:

- [ ] **Tasks page:** Click a task → slide panel opens from right. Edit title, due date, assignee, notes → auto-saves. Toggle checkbox → updates. Delete → removes. Close via ✕, backdrop, or Escape.
- [ ] **Tasks mobile:** Resize to <768px → panel comes from bottom as bottom sheet. Drag handle dismisses.
- [ ] **Calendar view:** Click an event chip → event slide panel opens. Edit fields → auto-saves. Delete → event removed from calendar grid.
- [ ] **Events list view:** Switch to Events toggle → see month-grouped cards. Click a card → event panel opens. Edit/delete → list updates.
- [ ] **View toggle state:** URL updates with `?view=events`. Refresh preserves the view.
- [ ] **Single panel rule:** Only one panel open at a time. Clicking another item swaps content.
