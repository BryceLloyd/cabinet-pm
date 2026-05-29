"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { format, isPast, isToday } from "date-fns";
import { Plus } from "lucide-react";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { AddTaskPanel } from "@/components/tasks/add-task-panel";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: number;
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

type Filter = "mine" | "all" | "personal" | "completed";

/* ── Shared row renderers ── */

function DesktopTaskRow({ t, onClick }: { t: TaskRow; onClick: () => void }) {
  const overdue = !t.completed_at && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
  return (
    <tr
      className={`hover:bg-muted/30 cursor-pointer ${t.completed_at ? "opacity-50" : ""}`}
      onClick={onClick}
    >
      <td className="px-4 py-3">
        <div className={t.completed_at ? "line-through text-muted-foreground" : "font-medium"}>
          {t.title}
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {t.projects ? (
          <Link href={`/projects/${t.project_id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{t.projects.name}</Link>
        ) : (
          <span className="italic">Personal</span>
        )}
        {t.room_groups && <span> · {t.room_groups.name}</span>}
        {t.rooms && <span> · {t.rooms.name}</span>}
      </td>
      <td className={`px-4 py-3 tabular-nums ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
        {t.due_date ? format(new Date(t.due_date), "MMM d, yyyy") : "—"}
      </td>
    </tr>
  );
}

function MobileTaskCard({ t, onClick }: { t: TaskRow; onClick: () => void }) {
  const overdue = !t.completed_at && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
  return (
    <div
      className={`rounded-lg border bg-card p-3 cursor-pointer ${t.completed_at ? "opacity-50" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className={`text-sm ${t.completed_at ? "line-through text-muted-foreground" : "font-medium"}`}>
            {t.title}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2">
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
    </div>
  );
}

/* ── Main component ── */

export function TasksClient({
  initialTasks,
  projects,
  profiles,
  taskTypes,
  userId,
  filter,
}: {
  initialTasks: TaskRow[];
  projects: ProjectOption[];
  profiles: ProfileOption[];
  taskTypes: TaskTypeOption[];
  userId: string;
  filter: Filter;
}) {
  const supabase = createClient();
  const [tasks, setTasks] = useState(initialTasks);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectStr = "*, projects(name), rooms(name), room_groups(name), task_types(id,name,color), assignee:assigned_to(full_name), completer:completed_by(full_name)";

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
                    {group.tasks.map((t) => (
                      <DesktopTaskRow key={t.id} t={t} onClick={() => setSelectedTask(t)} />
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Mobile grouped */}
          <div className="md:hidden space-y-4">
            {groupedByType!.map((group) => (
              <div key={group.key}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  {group.color && (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                  )}
                  <span className="text-sm font-medium">{group.label}</span>
                  <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
                </div>
                <div className="space-y-2">
                  {group.tasks.map((t) => (
                    <MobileTaskCard key={t.id} t={t} onClick={() => setSelectedTask(t)} />
                  ))}
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
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      No tasks.
                    </td>
                  </tr>
                )}
                {tasks.map((t) => {
                  const overdue = !t.completed_at && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-muted/30 cursor-pointer ${t.completed_at ? "opacity-50" : ""}`}
                      onClick={() => setSelectedTask(t)}
                    >
                      <td className="px-4 py-3">
                        <div className={t.completed_at ? "line-through text-muted-foreground" : "font-medium"}>
                          {t.title}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {t.task_types ? (
                          <span
                            className="inline-flex items-center text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: `${t.task_types.color}20`, color: t.task_types.color }}
                          >
                            {t.task_types.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.projects ? (
                          <Link href={`/projects/${t.project_id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{t.projects.name}</Link>
                        ) : (
                          <span className="italic">Personal</span>
                        )}
                        {t.room_groups && <span> · {t.room_groups.name}</span>}
                        {t.rooms && <span> · {t.rooms.name}</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{t.assignee?.full_name || "—"}</td>
                      <td className={`px-4 py-3 tabular-nums ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {t.due_date ? format(new Date(t.due_date), "MMM d, yyyy") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile flat list */}
          <div className="md:hidden space-y-2">
            {tasks.length === 0 && (
              <div className="rounded-lg border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
                No tasks.
              </div>
            )}
            {tasks.map((t) => {
              const overdue = !t.completed_at && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
              return (
                <div
                  key={t.id}
                  className={`rounded-lg border bg-card p-3 cursor-pointer ${t.completed_at ? "opacity-50" : ""}`}
                  onClick={() => setSelectedTask(t)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${t.completed_at ? "line-through text-muted-foreground" : "font-medium"}`}>
                        {t.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2">
                        {t.task_types && (
                          <span
                            className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: `${t.task_types.color}20`, color: t.task_types.color }}
                          >
                            {t.task_types.name}
                          </span>
                        )}
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
                </div>
              );
            })}
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
        userId={userId}
        onClose={() => setSelectedTask(null)}
        onUpdated={handleTaskUpdated}
        onDeleted={handleTaskDeleted}
        onToggleComplete={(t) => { toggleTask(t); }}
      />
    </div>
  );
}
