"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { format, isPast, isToday } from "date-fns";
import { Plus, GripVertical, ListChecks } from "lucide-react";
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
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { AddTaskPanel } from "@/components/tasks/add-task-panel";

interface ChecklistSummaryItem {
  id: string;
  completed_at: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: number;
  sort_order: number;
  project_id: string | null;
  room_id: string | null;
  room_group_id: string | null;
  task_type_id: string | null;
  assigned_to: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  created_at: string;
  projects: { name: string } | null;
  rooms: { name: string } | null;
  room_groups: { name: string } | null;
  task_types: { id: string; name: string; color: string } | null;
  assignee: { full_name: string } | null;
  completer: { full_name: string } | null;
  task_checklist_items: ChecklistSummaryItem[] | null;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface ProfileOption {
  id: string;
  full_name: string;
}

interface TaskTypeOption {
  id: string;
  name: string;
  color: string;
}

interface TemplateOption {
  id: string;
  name: string;
  items: string[];
}

type Filter = "mine" | "all" | "personal" | "completed";

/* ── Small helpers ── */

function ChecklistBadge({ items }: { items: ChecklistSummaryItem[] | null | undefined }) {
  if (!items || items.length === 0) return null;
  const done = items.filter((i) => i.completed_at).length;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-muted-foreground"
      title={`${done} of ${items.length} checklist items done`}
    >
      <ListChecks size={11} />
      {done}/{items.length}
    </span>
  );
}

function TypeBadge({ type, mobile }: { type: TaskRow["task_types"]; mobile?: boolean }) {
  if (!type) return mobile ? null : <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={`inline-flex items-center rounded font-medium ${mobile ? "text-[10px] px-1.5 py-0.5" : "text-xs px-1.5 py-0.5"}`}
      style={{ backgroundColor: `${type.color}20`, color: type.color }}
    >
      {type.name}
    </span>
  );
}

function DragHandle({ attributes, listeners }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners: any;
}) {
  return (
    <button
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-foreground"
      aria-label="Drag to reorder"
    >
      <GripVertical size={14} />
    </button>
  );
}

/* ── Sortable row renderers ── */

function SortableDesktopRow({
  t,
  variant,
  reorderable,
  onClick,
}: {
  t: TaskRow;
  variant: "grouped" | "flat";
  reorderable: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: t.id, disabled: !reorderable });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
    zIndex: isDragging ? 10 : undefined,
  };
  const overdue = !t.completed_at && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-muted/30 cursor-pointer ${t.completed_at ? "opacity-50" : ""}`}
      onClick={onClick}
    >
      {reorderable && (
        <td className="w-8 pl-3 py-3" onClick={(e) => e.stopPropagation()}>
          <DragHandle attributes={attributes} listeners={listeners} />
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={t.completed_at ? "line-through text-muted-foreground" : "font-medium"}>
            {t.title}
          </span>
          <ChecklistBadge items={t.task_checklist_items} />
        </div>
      </td>
      {variant === "flat" && (
        <td className="px-4 py-3">
          <TypeBadge type={t.task_types} />
        </td>
      )}
      <td className="px-4 py-3 text-muted-foreground">
        {t.projects ? (
          <Link href={`/projects/${t.project_id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{t.projects.name}</Link>
        ) : (
          <span className="italic">Personal</span>
        )}
        {t.room_groups && <span> · {t.room_groups.name}</span>}
        {t.rooms && <span> · {t.rooms.name}</span>}
      </td>
      {variant === "flat" && (
        <td className="px-4 py-3 text-muted-foreground">{t.assignee?.full_name || "—"}</td>
      )}
      <td className={`px-4 py-3 tabular-nums ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
        {t.due_date ? format(new Date(t.due_date), "MMM d, yyyy") : "—"}
      </td>
    </tr>
  );
}

function SortableMobileCard({
  t,
  variant,
  reorderable,
  onClick,
}: {
  t: TaskRow;
  variant: "grouped" | "flat";
  reorderable: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: t.id, disabled: !reorderable });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };
  const overdue = !t.completed_at && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-card px-3 py-2 cursor-pointer flex items-start gap-2 ${t.completed_at ? "opacity-50" : ""}`}
      onClick={onClick}
    >
      {reorderable && (
        <span className="mt-0.5 shrink-0">
          <DragHandle attributes={attributes} listeners={listeners} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className={`text-sm flex items-center gap-2 ${t.completed_at ? "line-through text-muted-foreground" : "font-medium"}`}>
          <span className="min-w-0 truncate">{t.title}</span>
          <ChecklistBadge items={t.task_checklist_items} />
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2">
          {variant === "flat" && <TypeBadge type={t.task_types} mobile />}
          {t.projects ? (
            <>
              <Link href={`/projects/${t.project_id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{t.projects.name}</Link>
              {t.room_groups && <span>· {t.room_groups.name}</span>}
              {t.rooms && <span>· {t.rooms.name}</span>}
            </>
          ) : (
            <span className="italic">Personal</span>
          )}
          {t.assignee?.full_name && <span>{t.assignee.full_name}</span>}
        </div>
      </div>
      {t.due_date && (
        <span className={`text-xs tabular-nums shrink-0 ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          {format(new Date(t.due_date), "MMM d")}
        </span>
      )}
    </div>
  );
}

/* ── Reorder wrapper (one isolated drag context per list) ── */

function Reorder({
  ids,
  reorderable,
  onDragEnd,
  children,
}: {
  ids: string[];
  reorderable: boolean;
  onDragEnd: (e: DragEndEvent) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  if (!reorderable) return <>{children}</>;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/* ── Main component ── */

export function TasksClient({
  initialTasks,
  projects,
  profiles,
  taskTypes,
  templates,
  userId,
  filter,
}: {
  initialTasks: TaskRow[];
  projects: ProjectOption[];
  profiles: ProfileOption[];
  taskTypes: TaskTypeOption[];
  templates: TemplateOption[];
  userId: string;
  filter: Filter;
}) {
  const supabase = createClient();
  const [tasks, setTasks] = useState(initialTasks);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectStr = "*, projects(name), rooms(name), room_groups(name), task_types(id,name,color), assignee:assigned_to(full_name), completer:completed_by(full_name), task_checklist_items(id, completed_at)";

  const reorderable = filter !== "completed";

  useEffect(() => {
    return () => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current); };
  }, []);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "mine", label: "My tasks" },
    { key: "all", label: "All open" },
    { key: "personal", label: "Personal" },
    { key: "completed", label: "Completed" },
  ];

  // Group tasks by type for "mine" view
  const groupedByType = useMemo(() => {
    if (filter !== "mine") return null;

    const groups: { key: string; label: string; color: string | null; tasks: TaskRow[] }[] = [];
    const byTypeId = new Map<string, TaskRow[]>();
    const untyped: TaskRow[] = [];

    for (const t of tasks) {
      if (t.task_type_id && t.task_types) {
        const list = byTypeId.get(t.task_type_id) || [];
        list.push(t);
        byTypeId.set(t.task_type_id, list);
      } else {
        untyped.push(t);
      }
    }

    // Add type groups in taskTypes sort order
    for (const tt of taskTypes) {
      const typeTasks = byTypeId.get(tt.id);
      if (typeTasks && typeTasks.length > 0) {
        groups.push({ key: tt.id, label: tt.name, color: tt.color, tasks: typeTasks });
      }
    }

    // Add untyped at the end
    if (untyped.length > 0) {
      groups.push({ key: "_other", label: "Other", color: null, tasks: untyped });
    }

    return groups;
  }, [tasks, taskTypes, filter]);

  function reorder(activeId: string, overId: string) {
    if (activeId === overId) return;
    const oldIndex = tasks.findIndex((t) => t.id === activeId);
    const newIndex = tasks.findIndex((t) => t.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const renumbered = arrayMove(tasks, oldIndex, newIndex).map((t, i) => ({ ...t, sort_order: i }));
    setTasks(renumbered);

    // Persist only rows whose sort_order actually changed.
    const prevOrder = new Map(tasks.map((t) => [t.id, t.sort_order]));
    Promise.all(
      renumbered
        .filter((t) => prevOrder.get(t.id) !== t.sort_order)
        .map((t) => supabase.from("tasks").update({ sort_order: t.sort_order }).eq("id", t.id)),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    reorder(String(active.id), String(over.id));
  }

  async function toggleTask(task: TaskRow) {
    const updates = task.completed_at
      ? { completed_at: null, completed_by: null }
      : { completed_at: new Date().toISOString(), completed_by: userId };
    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", task.id)
      .select(selectStr)
      .single();
    if (!error && data) {
      const updated = data as TaskRow;
      if (filter === "completed" && task.completed_at) {
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
      } else if (!task.completed_at && filter !== "completed") {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = setTimeout(() => setTasks((prev) => prev.filter((t) => t.id !== task.id)), 600);
      } else {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      }
      if (selectedTask?.id === task.id) setSelectedTask(updated);
    }
  }

  function handleTaskUpdated(updated: TaskRow) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTask(updated);
  }

  function handleTaskDeleted(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedTask(null);
  }

  function handleTaskCreated(task: TaskRow) {
    setTasks((prev) => [task, ...prev]);
  }

  function handleChecklistChange(taskId: string, items: ChecklistSummaryItem[]) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, task_checklist_items: items } : t)));
    setSelectedTask((cur) => (cur && cur.id === taskId ? { ...cur, task_checklist_items: items } : cur));
  }

  const isGrouped = filter === "mine" && groupedByType && groupedByType.length > 0;

  return (
    <div className="container py-6 md:py-8 px-4">
      {/* Filter tabs */}
      <div className="flex items-center rounded-md border p-0.5 mb-5 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/tasks?filter=${f.key}` as const}
            className={`h-7 px-3 text-xs rounded grid place-items-center whitespace-nowrap ${
              filter === f.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Grouped "My tasks" view */}
      {isGrouped ? (
        <>
          {/* Desktop grouped */}
          <div className="hidden md:block space-y-4">
            {groupedByType!.map((group) => (
              <div key={group.key} className="rounded-lg border bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
                  {group.color && (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                  )}
                  <span className="text-sm font-medium">{group.label}</span>
                  <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    <Reorder ids={group.tasks.map((t) => t.id)} reorderable={reorderable} onDragEnd={handleDragEnd}>
                      {group.tasks.map((t) => (
                        <SortableDesktopRow key={t.id} t={t} variant="grouped" reorderable={reorderable} onClick={() => setSelectedTask(t)} />
                      ))}
                    </Reorder>
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Mobile grouped */}
          <div className="md:hidden space-y-3">
            {groupedByType!.map((group) => (
              <div key={group.key}>
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  {group.color && (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                  )}
                  <span className="text-sm font-medium">{group.label}</span>
                  <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
                </div>
                <div className="space-y-1.5">
                  <Reorder ids={group.tasks.map((t) => t.id)} reorderable={reorderable} onDragEnd={handleDragEnd}>
                    {group.tasks.map((t) => (
                      <SortableMobileCard key={t.id} t={t} variant="grouped" reorderable={reorderable} onClick={() => setSelectedTask(t)} />
                    ))}
                  </Reorder>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Desktop flat table */}
          <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {reorderable && <th className="w-8" />}
                  <th className="text-left font-medium px-4 py-2.5">Task</th>
                  <th className="text-left font-medium px-4 py-2.5">Type</th>
                  <th className="text-left font-medium px-4 py-2.5">Project / Room</th>
                  <th className="text-left font-medium px-4 py-2.5">Assignee</th>
                  <th className="text-left font-medium px-4 py-2.5">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={reorderable ? 6 : 5} className="px-4 py-12 text-center text-muted-foreground">
                      No tasks.
                    </td>
                  </tr>
                )}
                <Reorder ids={tasks.map((t) => t.id)} reorderable={reorderable} onDragEnd={handleDragEnd}>
                  {tasks.map((t) => (
                    <SortableDesktopRow key={t.id} t={t} variant="flat" reorderable={reorderable} onClick={() => setSelectedTask(t)} />
                  ))}
                </Reorder>
              </tbody>
            </table>
          </div>

          {/* Mobile flat list */}
          <div className="md:hidden space-y-1.5">
            {tasks.length === 0 && (
              <div className="rounded-lg border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
                No tasks.
              </div>
            )}
            <Reorder ids={tasks.map((t) => t.id)} reorderable={reorderable} onDragEnd={handleDragEnd}>
              {tasks.map((t) => (
                <SortableMobileCard key={t.id} t={t} variant="flat" reorderable={reorderable} onClick={() => setSelectedTask(t)} />
              ))}
            </Reorder>
          </div>
        </>
      )}

      {/* Empty state for grouped view */}
      {filter === "mine" && tasks.length === 0 && (
        <div className="rounded-lg border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          No tasks. You're all clear.
        </div>
      )}

      {/* Floating pill – desktop only */}
      <button
        onClick={() => setShowAddPanel(true)}
        className="hidden md:inline-flex fixed bottom-6 right-6 z-40 items-center gap-2 h-10 pl-4 pr-5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg hover:opacity-90 transition-opacity"
      >
        <Plus size={18} />
        New task
      </button>

      {/* Add task slide panel */}
      <AddTaskPanel
        open={showAddPanel}
        projects={projects}
        profiles={profiles}
        taskTypes={taskTypes}
        userId={userId}
        onClose={() => setShowAddPanel(false)}
        onCreated={handleTaskCreated}
      />

      {/* Task detail panel */}
      <TaskDetailPanel
        task={selectedTask}
        profiles={profiles}
        taskTypes={taskTypes}
        templates={templates}
        userId={userId}
        onClose={() => setSelectedTask(null)}
        onUpdated={handleTaskUpdated}
        onDeleted={handleTaskDeleted}
        onToggleComplete={(t) => { toggleTask(t); }}
        onChecklistChange={handleChecklistChange}
      />
    </div>
  );
}
