"use client";

import { useState, useEffect } from "react";
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

interface AddTaskPanelProps {
  open: boolean;
  projects: ProjectOption[];
  profiles: ProfileOption[];
  taskTypes: TaskTypeOption[];
  templates?: TemplateOption[];
  userId: string;
  onClose: () => void;
  onCreated: (task: any) => void;
}

export function AddTaskPanel({
  open,
  projects,
  profiles,
  taskTypes,
  templates = [],
  userId,
  onClose,
  onCreated,
}: AddTaskPanelProps) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [roomGroupId, setRoomGroupId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [taskTypeId, setTaskTypeId] = useState("");
  const [assignee, setAssignee] = useState(userId);
  const [notes, setNotes] = useState("");
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [saving, setSaving] = useState(false);

  const [roomGroups, setRoomGroups] = useState<{ id: string; name: string }[]>([]);
  const [rooms, setRooms] = useState<{ id: string; name: string; room_group_id: string | null }[]>([]);

  useEffect(() => {
    if (!projectId) {
      setRoomGroups([]);
      setRooms([]);
      setRoomGroupId("");
      setRoomId("");
      return;
    }
    Promise.all([
      supabase.from("room_groups").select("id, name").eq("project_id", projectId).order("sort_order"),
      supabase.from("rooms").select("id, name, room_group_id").eq("project_id", projectId).order("sort_order"),
    ]).then(([{ data: rg }, { data: r }]) => {
      setRoomGroups(rg || []);
      setRooms(r || []);
    });
  }, [projectId, supabase]);

  const filteredRooms = roomGroupId
    ? rooms.filter((r) => r.room_group_id === roomGroupId)
    : rooms;

  function resetForm() {
    setTitle("");
    setDueDate("");
    setProjectId("");
    setRoomGroupId("");
    setRoomId("");
    setTaskTypeId("");
    setAssignee(userId);
    setNotes("");
    setSubtasks([]);
    setNewSubtask("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function addSubtask() {
    const t = newSubtask.trim();
    if (!t) return;
    setSubtasks((prev) => [...prev, t]);
    setNewSubtask("");
  }

  function removeSubtask(index: number) {
    setSubtasks((prev) => prev.filter((_, i) => i !== index));
  }

  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl || tpl.items.length === 0) return;
    setSubtasks((prev) => [...prev, ...tpl.items]);
  }

  async function handleSubmit() {
    if (!title.trim() || saving) return;
    setSaving(true);

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        description: notes.trim() || null,
        project_id: projectId || null,
        room_group_id: roomGroupId || null,
        room_id: roomId || null,
        task_type_id: taskTypeId || null,
        assigned_to: assignee || null,
        due_date: dueDate || null,
        created_by: userId,
      })
      .select("*, projects(name), rooms(name), room_groups(name), task_types(id,name,color), assignee:assigned_to(full_name), completer:completed_by(full_name), task_checklist_items(id, completed_at)")
      .single();

    if (error || !data) {
      setSaving(false);
      return;
    }

    // Insert subtasks (checklist items) for the new task, if any.
    const items = subtasks.map((s) => s.trim()).filter(Boolean);
    if (items.length > 0) {
      const rows = items.map((title, i) => ({
        task_id: data.id,
        title,
        sort_order: i,
      }));
      const { data: inserted } = await supabase
        .from("task_checklist_items")
        .insert(rows)
        .select("id, completed_at");
      if (inserted) {
        // Attach so the list badge reflects the new subtasks immediately.
        data.task_checklist_items = inserted;
      }
    }

    setSaving(false);
    onCreated(data);
    resetForm();
    onClose();
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

      {/* Task type */}
      {taskTypes.length > 0 && (
        <div className="mb-4">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Type
          </label>
          <select
            value={taskTypeId}
            onChange={(e) => setTaskTypeId(e.target.value)}
            className="w-full h-9 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">No type</option>
            {taskTypes.map((tt) => (
              <option key={tt.id} value={tt.id}>{tt.name}</option>
            ))}
          </select>
        </div>
      )}

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
            setRoomGroupId("");
            setRoomId("");
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

      {/* Room group */}
      {roomGroups.length > 0 && (
        <div className="mb-4">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Room group
          </label>
          <select
            value={roomGroupId}
            onChange={(e) => {
              setRoomGroupId(e.target.value);
              setRoomId("");
            }}
            className="w-full h-9 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">No group</option>
            {roomGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Room */}
      {filteredRooms.length > 0 && (
        <div className="mb-4">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Room
          </label>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="w-full h-9 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">No room</option>
            {filteredRooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      )}

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
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes..."
          rows={4}
          className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {/* Subtasks */}
      <div className="mb-6">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Subtasks
        </label>

        {templates.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) applyTemplate(e.target.value);
              e.target.value = "";
            }}
            className="w-full h-9 px-2 mb-2 rounded-md border bg-background text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Add from template…</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
            ))}
          </select>
        )}

        {subtasks.length > 0 && (
          <ul className="mb-2 space-y-1">
            {subtasks.map((item, i) => (
              <li
                key={i}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border bg-background text-sm"
              >
                <span className="flex-1 truncate">{item}</span>
                <button
                  type="button"
                  onClick={() => removeSubtask(i)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remove subtask"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSubtask();
              }
            }}
            placeholder="Add a subtask…"
            className="flex-1 h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={addSubtask}
            disabled={!newSubtask.trim()}
            className="h-9 px-3 rounded-md border bg-background text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Add subtask"
          >
            Add
          </button>
        </div>
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
