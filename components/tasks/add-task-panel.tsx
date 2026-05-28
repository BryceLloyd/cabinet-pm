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
  const [roomGroupId, setRoomGroupId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [notes, setNotes] = useState("");
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
        room_group_id: roomGroupId || null,
        room_id: roomId || null,
        assigned_to: isPersonal ? userId : assignee || null,
        due_date: dueDate || null,
        created_by: userId,
      })
      .select("*, projects(name), rooms(name), room_groups(name), assignee:assigned_to(full_name), completer:completed_by(full_name)")
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
