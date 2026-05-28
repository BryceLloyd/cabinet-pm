"use client";

import { useState, useRef, useEffect } from "react";
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

interface ProjectOption {
  id: string;
  name: string;
}

interface ProfileOption {
  id: string;
  full_name: string;
}

type Filter = "mine" | "all" | "personal" | "completed";

export function TasksClient({
  initialTasks,
  projects,
  profiles,
  userId,
  filter,
}: {
  initialTasks: TaskRow[];
  projects: ProjectOption[];
  profiles: ProfileOption[];
  userId: string;
  filter: Filter;
}) {
  const supabase = createClient();
  const [tasks, setTasks] = useState(initialTasks);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current); };
  }, []);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "mine", label: "My tasks" },
    { key: "all", label: "All open" },
    { key: "personal", label: "Personal" },
    { key: "completed", label: "Completed" },
  ];

  async function toggleTask(task: TaskRow) {
    const updates = task.completed_at
      ? { completed_at: null, completed_by: null }
      : { completed_at: new Date().toISOString(), completed_by: userId };
    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", task.id)
      .select("*, projects(name), rooms(name), assignee:assigned_to(full_name), completer:completed_by(full_name)")
      .single();
    if (!error && data) {
      const updated = data as TaskRow;
      if (filter === "completed" && task.completed_at) {
        // Uncompleting from completed view: remove from list
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
      } else if (!task.completed_at && filter !== "completed") {
        // Completing from open views: show strikethrough then remove
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

      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Task</th>
              <th className="text-left font-medium px-4 py-2.5">Project / Room</th>
              <th className="text-left font-medium px-4 py-2.5">Assignee</th>
              <th className="text-left font-medium px-4 py-2.5">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                  No tasks. {filter === "mine" ? "You're all clear." : ""}
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
                  <td className="px-4 py-3 text-muted-foreground">
                    {t.projects ? (
                      <Link href={`/projects/${t.project_id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{t.projects.name}</Link>
                    ) : (
                      <span className="italic">Personal</span>
                    )}
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

      {/* Mobile list */}
      <div className="md:hidden space-y-2">
        {tasks.length === 0 && (
          <div className="rounded-lg border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
            No tasks. {filter === "mine" ? "You're all clear." : ""}
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
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    {t.projects ? (
                      <Link href={`/projects/${t.project_id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{t.projects.name}</Link>
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
        userId={userId}
        onClose={() => setShowAddPanel(false)}
        onCreated={handleTaskCreated}
      />

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
    </div>
  );
}
