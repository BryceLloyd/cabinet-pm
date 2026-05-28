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
  room_group_id: string | null;
  assigned_to: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  created_at: string;
  projects: { name: string } | null;
  rooms: { name: string } | null;
  room_groups: { name: string } | null;
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
  const [roomGroupId, setRoomGroupId] = useState("");
  const [roomId, setRoomId] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [roomGroups, setRoomGroups] = useState<{ id: string; name: string }[]>([]);
  const [rooms, setRooms] = useState<{ id: string; name: string; room_group_id: string | null }[]>([]);

  // Sync local state when task changes
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description || "");
    setDueDate(task.due_date || "");
    setAssignedTo(task.assigned_to || "");
    setRoomGroupId(task.room_group_id || "");
    setRoomId(task.room_id || "");
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load room groups and rooms when task has a project
  useEffect(() => {
    if (!task?.project_id) {
      setRoomGroups([]);
      setRooms([]);
      return;
    }
    Promise.all([
      supabase.from("room_groups").select("id, name").eq("project_id", task.project_id).order("sort_order"),
      supabase.from("rooms").select("id, name, room_group_id").eq("project_id", task.project_id).order("sort_order"),
    ]).then(([{ data: rg }, { data: r }]) => {
      setRoomGroups(rg || []);
      setRooms(r || []);
    });
  }, [task?.project_id, supabase]);

  const filteredRooms = roomGroupId
    ? rooms.filter((r) => r.room_group_id === roomGroupId)
    : rooms;

  const selectStr = "*, projects(name), rooms(name), room_groups(name), assignee:assigned_to(full_name), completer:completed_by(full_name)";

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
          .select(selectStr)
          .single();
        if (!error && data) {
          onUpdated(data as TaskRow);
        }
      }, 800);
    },
    [task, supabase, onUpdated], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Immediate save (no debounce) for multi-field updates
  const saveFields = useCallback(
    async (updates: Record<string, string | null>) => {
      if (!task) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", task.id)
        .select(selectStr)
        .single();
      if (!error && data) {
        onUpdated(data as TaskRow);
      }
    },
    [task, supabase, onUpdated], // eslint-disable-line react-hooks/exhaustive-deps
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
    ? `${task.projects.name}${task.room_groups ? ` · ${task.room_groups.name}` : ""}${task.rooms ? ` · ${task.rooms.name}` : ""}`
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

      {/* Room group – only for project tasks with groups */}
      {task.project_id && roomGroups.length > 0 && (
        <div className="mb-4">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Room group
          </label>
          <select
            value={roomGroupId}
            onChange={(e) => {
              const newGroupId = e.target.value;
              setRoomGroupId(newGroupId);
              setRoomId("");
              saveFields({ room_group_id: newGroupId || null, room_id: null });
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

      {/* Room – only for project tasks with rooms */}
      {task.project_id && filteredRooms.length > 0 && (
        <div className="mb-4">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Room
          </label>
          <select
            value={roomId}
            onChange={(e) => {
              setRoomId(e.target.value);
              autoSave("room_id", e.target.value);
            }}
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
