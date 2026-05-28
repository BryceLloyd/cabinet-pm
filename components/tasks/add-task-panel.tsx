"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SlidePanel } from "@/components/ui/slide-panel";

interface ProjectOption {
  id: string;
  name: string;
}

interface ProfileOption {
  id: string;
  full_name: string;
}

interface AddTaskPanelProps {
  open: boolean;
  projects: ProjectOption[];
  profiles: ProfileOption[];
  userId: string;
  onClose: () => void;
  onCreated: (task: any) => void;
}

export function AddTaskPanel({
  open,
  projects,
  profiles,
  userId,
  onClose,
  onCreated,
}: AddTaskPanelProps) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setTitle("");
    setDueDate("");
    setProjectId("");
    setAssignee("");
    setNotes("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    if (!title.trim() || saving) return;
    setSaving(true);

    const isPersonal = !projectId;
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        description: notes.trim() || null,
        project_id: projectId || null,
        room_id: null,
        assigned_to: isPersonal ? userId : assignee || null,
        due_date: dueDate || null,
        created_by: userId,
      })
      .select("*, projects(name), rooms(name), assignee:assigned_to(full_name), completer:completed_by(full_name)")
      .single();

    setSaving(false);

    if (!error && data) {
      onCreated(data);
      resetForm();
      onClose();
    }
  }

  return (
    <SlidePanel open={open} onClose={handleClose} title="New Task">
      {/* Title */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="What needs to be done?"
          autoFocus
          className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
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
            if (!e.target.value) setAssignee("");
          }}
          className="w-full h-9 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Personal todo</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Assignee */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Assigned to
        </label>
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          disabled={!projectId}
          className="w-full h-9 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">{projectId ? "Unassigned" : "Assigned to you"}</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name}</option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes..."
          rows={4}
          className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!title.trim() || saving}
        className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Creating..." : "Create task"}
      </button>
    </SlidePanel>
  );
}
