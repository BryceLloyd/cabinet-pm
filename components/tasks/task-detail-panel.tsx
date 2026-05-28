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
  const creatorName = profiles.find((p) => p.id === task.created_by)?.full_name;

  return (
    <SlidePanel
      open={!!task}
      onClose={onClose}
      title="Task Detail"
      onDelete={handleDelete}
    >
      {/* Title */}
      <div className="mb-5">
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            autoSave("title", e.target.value);
          }}
          className="w-full text-[15px] font-medium bg-transparent border border-transparent hover:border-border focus:border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Complete button – open tasks only */}
      {!task.completed_at && (
        <button
          onClick={() => onToggleComplete(task)}
          className="w-full h-9 rounded-md text-sm font-medium mb-5 bg-primary text-primary-foreground hover:opacity-90 transition-colors"
        >
          Complete
        </button>
      )}

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
      <div className="pt-3 border-t text-[11px] text-muted-foreground space-y-0.5">
        <div>{projectLabel}</div>
        <div>Created {format(new Date(task.created_at), "MMM d, yyyy")}{creatorName ? ` by ${creatorName}` : ""}</div>
        {task.completed_at && (
          <div>Completed {format(new Date(task.completed_at), "MMM d, yyyy")}{task.completer?.full_name ? ` by ${task.completer.full_name}` : ""}</div>
        )}
      </div>
    </SlidePanel>
  );
}
