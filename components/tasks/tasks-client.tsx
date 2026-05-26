"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { format, isPast, isToday } from "date-fns";

interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  priority: number;
  project_id: string | null;
  room_id: string | null;
  assigned_to: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
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
  const router = useRouter();
  const supabase = createClient();
  const [tasks, setTasks] = useState(initialTasks);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assignee, setAssignee] = useState("");

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "mine", label: "My tasks" },
    { key: "all", label: "All open" },
    { key: "personal", label: "Personal" },
    { key: "completed", label: "Completed" },
  ];

  async function addTask() {
    if (!title.trim()) return;
    const isPersonal = !projectId;
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        project_id: projectId || null,
        room_id: null,
        assigned_to: isPersonal ? userId : assignee || null,
        due_date: dueDate || null,
        created_by: userId,
      })
      .select("*, projects(name), rooms(name), assignee:assigned_to(full_name), completer:completed_by(full_name)")
      .single();
    if (!error && data) {
      setTasks([data as TaskRow, ...tasks]);
      setTitle("");
      setDueDate("");
      setProjectId("");
      setAssignee("");
      setShowForm(false);
    }
  }

  async function toggleTask(task: TaskRow) {
    const updates = task.completed_at
      ? { completed_at: null, completed_by: null }
      : { completed_at: new Date().toISOString(), completed_by: userId };
    const { error } = await supabase.from("tasks").update(updates).eq("id", task.id);
    if (!error) {
      if (filter === "completed" && !task.completed_at) {
        // Completing: keep in list for completed view
        setTasks(tasks.map((t) => (t.id === task.id ? { ...t, ...updates } as TaskRow : t)));
      } else if (filter === "completed" && task.completed_at) {
        // Uncompleting from completed view: remove
        setTasks(tasks.filter((t) => t.id !== task.id));
      } else if (!task.completed_at) {
        // Completing from open views: remove after brief delay
        setTasks(tasks.map((t) => (t.id === task.id ? { ...t, ...updates } as TaskRow : t)));
        setTimeout(() => setTasks((prev) => prev.filter((t) => t.id !== task.id)), 600);
      } else {
        setTasks(tasks.map((t) => (t.id === task.id ? { ...t, ...updates } as TaskRow : t)));
      }
    }
  }

  return (
    <div className="container py-6 md:py-8 px-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Tasks</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
        >
          {showForm ? "Cancel" : "+ Add task"}
        </button>
      </div>

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

      {/* Add task form */}
      {showForm && (
        <div className="rounded-lg border bg-card p-4 mb-5 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="What needs to be done?"
            className="w-full h-9 px-3 text-sm rounded-md border bg-background"
            autoFocus
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-9 px-2 text-sm rounded-md border bg-background"
            >
              <option value="">Personal todo</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="h-9 px-2 text-sm rounded-md border bg-background"
              disabled={!projectId}
            >
              <option value="">{projectId ? "Unassigned" : "Assigned to you"}</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9 px-2 text-sm rounded-md border bg-background"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={addTask}
              className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Add task
            </button>
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-2.5" />
              <th className="text-left font-medium px-4 py-2.5">Task</th>
              <th className="text-left font-medium px-4 py-2.5">Project / Room</th>
              <th className="text-left font-medium px-4 py-2.5">Assignee</th>
              <th className="text-left font-medium px-4 py-2.5">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  No tasks. {filter === "mine" ? "You're all clear." : ""}
                </td>
              </tr>
            )}
            {tasks.map((t) => {
              const overdue = !t.completed_at && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
              return (
                <tr key={t.id} className={`hover:bg-muted/30 ${t.completed_at ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!!t.completed_at}
                      onChange={() => toggleTask(t)}
                      className="size-4 rounded border-input cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className={t.completed_at ? "line-through text-muted-foreground" : "font-medium"}>
                      {t.title}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t.projects ? (
                      <Link href={`/projects/${t.project_id}`} className="hover:underline">{t.projects.name}</Link>
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
            <div key={t.id} className={`rounded-lg border bg-card p-3 flex items-start gap-3 ${t.completed_at ? "opacity-50" : ""}`}>
              <input
                type="checkbox"
                checked={!!t.completed_at}
                onChange={() => toggleTask(t)}
                className="mt-0.5 size-4 rounded border-input cursor-pointer shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className={`text-sm ${t.completed_at ? "line-through text-muted-foreground" : "font-medium"}`}>
                  {t.title}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                  {t.projects ? (
                    <Link href={`/projects/${t.project_id}`} className="hover:underline">{t.projects.name}</Link>
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
        })}
      </div>
    </div>
  );
}
