"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Project, Room, Task, Phase, Profile, ProjectStatus, RoomGroup } from "@/lib/types";
import { RoomGroupManager } from "@/components/projects/room-group-manager";
import { PlanningSection } from "@/components/projects/planning-section";
import { format, addWeeks } from "date-fns";

interface Props {
  project: Project;
  initialRooms: Room[];
  initialTasks: Task[];
  phases: Phase[];
  profiles: Pick<Profile, "id" | "full_name">[];
  initialRoomGroups: RoomGroup[];
}

const STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "complete", label: "Complete" },
  { value: "cancelled", label: "Cancelled" },
];

export function ProjectDetailClient({ project: initialProject, initialRooms, initialTasks, phases, profiles, initialRoomGroups }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [project, setProject] = useState(initialProject);
  const [rooms, setRooms] = useState(initialRooms);
  const [tasks, setTasks] = useState(initialTasks);
  const [roomGroups, setRoomGroups] = useState(initialRoomGroups);
  const [newRoomName, setNewRoomName] = useState("");
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [editRoomForm, setEditRoomForm] = useState({ name: "", notes: "" });
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskRoom, setNewTaskRoom] = useState<string>("");
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>("");
  const [newTaskRoomGroup, setNewTaskRoomGroup] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: project.name,
    client_name: project.client_name || "",
    site_address: project.site_address || "",
    notes: project.notes || "",
    estimated_completion_date: project.estimated_completion_date,
    lead_time_weeks: project.lead_time_weeks,
    status: project.status,
  });

  const phaseMap = new Map(phases.map((p) => [p.id, p]));
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // no roomCountMap needed — RoomGroupManager now manages rooms directly

  async function addRoom() {
    if (!newRoomName.trim()) return;
    const defaultPhase = phases.find((p) => p.is_default);
    const { data, error } = await supabase
      .from("rooms")
      .insert({
        project_id: project.id,
        name: newRoomName.trim(),
        sort_order: rooms.length,
        current_phase_id: defaultPhase?.id || null,
      })
      .select("*")
      .single();
    if (error) {
      console.error("addRoom error:", error);
      alert(`Could not add room: ${error.message}`);
      return;
    }
    if (data) {
      setRooms([...rooms, data as Room]);
      setNewRoomName("");
    }
  }

  function startEditingRoom(room: Room) {
    setEditingRoom(room.id);
    setEditRoomForm({ name: room.name, notes: room.notes || "" });
  }

  async function saveRoom(roomId: string) {
    if (!editRoomForm.name.trim()) return;
    const { error } = await supabase
      .from("rooms")
      .update({ name: editRoomForm.name.trim(), notes: editRoomForm.notes.trim() || null })
      .eq("id", roomId);
    if (!error) {
      setRooms(rooms.map((r) => r.id === roomId ? { ...r, name: editRoomForm.name.trim(), notes: editRoomForm.notes.trim() || null } : r));
      setEditingRoom(null);
    }
  }

  async function deleteRoom(roomId: string) {
    const roomTasks = tasks.filter((t) => t.room_id === roomId);
    const msg = roomTasks.length > 0
      ? `Delete this room and unlink its ${roomTasks.length} task(s)?`
      : "Delete this room?";
    if (!confirm(msg)) return;
    const { error } = await supabase.from("rooms").delete().eq("id", roomId);
    if (!error) {
      setRooms(rooms.filter((r) => r.id !== roomId));
      setTasks(tasks.map((t) => t.room_id === roomId ? { ...t, room_id: null } as Task : t));
    }
  }

  async function addTask() {
    if (!newTaskTitle.trim()) return;
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: newTaskTitle.trim(),
        project_id: project.id,
        room_id: newTaskRoom || null,
        room_group_id: newTaskRoomGroup || null,
        assigned_to: newTaskAssignee || null,
        created_by: user.user.id,
      })
      .select("*")
      .single();
    if (!error && data) {
      setTasks([data as Task, ...tasks]);
      setNewTaskTitle("");
    }
  }

  async function toggleTask(task: Task) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const updates = task.completed_at
      ? { completed_at: null, completed_by: null }
      : { completed_at: new Date().toISOString(), completed_by: user.user.id };
    const { error } = await supabase.from("tasks").update(updates).eq("id", task.id);
    if (!error) {
      setTasks(tasks.map((t) => (t.id === task.id ? { ...t, ...updates } as Task : t)));
    }
  }

  function startEditing() {
    setEditForm({
      name: project.name,
      client_name: project.client_name || "",
      site_address: project.site_address || "",
      notes: project.notes || "",
      estimated_completion_date: project.estimated_completion_date,
      lead_time_weeks: project.lead_time_weeks,
      status: project.status,
    });
    setEditing(true);
  }

  async function saveProject(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase
      .from("projects")
      .update({
        name: editForm.name,
        client_name: editForm.client_name || null,
        site_address: editForm.site_address || null,
        notes: editForm.notes || null,
        estimated_completion_date: editForm.estimated_completion_date,
        lead_time_weeks: editForm.lead_time_weeks,
        status: editForm.status,
      })
      .eq("id", project.id)
      .select("*")
      .single();
    setSaving(false);
    if (!error && data) {
      setProject(data as Project);
      setEditing(false);
      router.refresh();
    }
  }

  const computedStart = editForm.estimated_completion_date
    ? format(addWeeks(new Date(editForm.estimated_completion_date), -editForm.lead_time_weeks), "MMM d, yyyy")
    : "—";

  return (
    <div className="space-y-6">
      {/* Project header */}
      {editing ? (
        <form onSubmit={saveProject} className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium">Edit project</h2>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Project name *</label>
            <input
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full h-9 px-3 text-sm rounded-md border bg-background"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Client name</label>
              <input
                value={editForm.client_name}
                onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })}
                className="w-full h-9 px-3 text-sm rounded-md border bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Site address</label>
              <input
                value={editForm.site_address}
                onChange={(e) => setEditForm({ ...editForm, site_address: e.target.value })}
                className="w-full h-9 px-3 text-sm rounded-md border bg-background"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Completion date *</label>
              <input
                type="date"
                required
                value={editForm.estimated_completion_date}
                onChange={(e) => setEditForm({ ...editForm, estimated_completion_date: e.target.value })}
                className="w-full h-9 px-3 text-sm rounded-md border bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Lead time (weeks)</label>
              <input
                type="number"
                min={1}
                value={editForm.lead_time_weeks}
                onChange={(e) => setEditForm({ ...editForm, lead_time_weeks: parseInt(e.target.value) || 8 })}
                className="w-full h-9 px-3 text-sm rounded-md border bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ProjectStatus })}
                className="w-full h-9 px-2 text-sm rounded-md border bg-background"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Start date:</span> {computedStart}
            <span className="ml-2">(auto-calculated)</span>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              className="w-full min-h-[60px] px-3 py-2 text-sm rounded-md border bg-background"
              placeholder="Key constraints, site access notes, etc."
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <button
                onClick={startEditing}
                className="h-7 px-2.5 rounded-md border text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Edit
              </button>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {project.client_name && <span>{project.client_name}</span>}
              {project.site_address && <span> · {project.site_address}</span>}
            </div>
            {project.notes && (
              <p className="mt-2 text-sm text-muted-foreground">{project.notes}</p>
            )}
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full border capitalize">
              {project.status.replace("_", " ")}
            </span>
          </div>
          <div className="text-right text-sm tabular-nums shrink-0">
            <div className="text-muted-foreground text-xs">Completion</div>
            <div className="font-medium">{format(new Date(project.estimated_completion_date), "MMM d, yyyy")}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Starts {format(new Date(project.start_date), "MMM d")} · {project.lead_time_weeks}w lead
            </div>
          </div>
        </div>
      )}

      {/* Room Groups */}
      <RoomGroupManager
        projectId={project.id}
        groups={roomGroups}
        rooms={rooms}
        phases={phases}
        onGroupsChange={setRoomGroups}
        onRoomsChange={setRooms}
      />

      {/* Planning */}
      <PlanningSection
        projectId={project.id}
        projectStart={project.start_date}
        projectEnd={project.estimated_completion_date}
        phases={phases}
        groups={roomGroups}
      />

    <div className="grid lg:grid-cols-5 gap-6">
      {/* Rooms */}
      <section className="lg:col-span-3 rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Rooms</h2>
        </div>
        <ul className="divide-y">
          {rooms.length === 0 && (
            <li className="px-5 py-8 text-sm text-muted-foreground text-center">
              No rooms yet. Add one below to start tracking phases.
            </li>
          )}
          {rooms.map((room) => {
            const roomTaskCount = tasks.filter((t) => t.room_id === room.id && !t.completed_at).length;
            const isEditing = editingRoom === room.id;

            if (isEditing) {
              return (
                <li key={room.id} className="px-5 py-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={editRoomForm.name}
                      onChange={(e) => setEditRoomForm({ ...editRoomForm, name: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && saveRoom(room.id)}
                      className="flex-1 h-8 px-3 text-sm rounded-md border bg-background"
                      autoFocus
                    />
                    <button
                      onClick={() => saveRoom(room.id)}
                      className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingRoom(null)}
                      className="h-8 px-3 rounded-md border text-xs hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                  <input
                    value={editRoomForm.notes}
                    onChange={(e) => setEditRoomForm({ ...editRoomForm, notes: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && saveRoom(room.id)}
                    placeholder="Notes (optional)"
                    className="w-full h-8 px-3 text-sm rounded-md border bg-background"
                  />
                </li>
              );
            }

            return (
              <li key={room.id} className="px-5 py-3 flex items-center justify-between gap-3 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{room.name}</span>
                    {roomTaskCount > 0 && (
                      <span className="text-xs text-muted-foreground">{roomTaskCount} task{roomTaskCount !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                  {room.notes && <div className="text-xs text-muted-foreground mt-0.5">{room.notes}</div>}
                </div>
                <div className="flex items-center gap-2">
                  {room.room_group_id && (() => {
                    const group = roomGroups.find((g) => g.id === room.room_group_id);
                    return group ? <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{group.name}</span> : null;
                  })()}
                  <button
                    onClick={() => startEditingRoom(room)}
                    className="h-7 w-7 rounded-md border grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Edit room"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteRoom(room.id)}
                    className="h-7 w-7 rounded-md border grid place-items-center text-muted-foreground hover:text-destructive hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete room"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="px-5 py-3 border-t flex gap-2">
          <input
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRoom()}
            placeholder="Add a room (e.g. Main Kitchen, Pantry)"
            className="flex-1 h-8 px-3 text-sm rounded-md border bg-background"
          />
          <button onClick={addRoom} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
            Add
          </button>
        </div>
      </section>

      {/* Tasks */}
      <section className="lg:col-span-2 rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Tasks</h2>
        </div>
        <ul className="divide-y max-h-[480px] overflow-y-auto">
          {tasks.length === 0 && (
            <li className="px-5 py-8 text-sm text-muted-foreground text-center">No tasks yet.</li>
          )}
          {tasks.map((task) => {
            const room = rooms.find((r) => r.id === task.room_id);
            const assignee = task.assigned_to ? profileMap.get(task.assigned_to) : null;
            const completedBy = task.completed_by ? profileMap.get(task.completed_by) : null;
            return (
              <li key={task.id} className="px-5 py-2.5 flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={!!task.completed_at}
                  onChange={() => toggleTask(task)}
                  className="mt-1 size-4 rounded border-input cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${task.completed_at ? "line-through text-muted-foreground" : ""}`}>
                    {task.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    {task.room_group_id && (() => {
                      const group = roomGroups.find((g) => g.id === task.room_group_id);
                      return group ? <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{group.name}</span> : null;
                    })()}
                    {room && <span>{room.name}</span>}
                    {assignee && <span>· {assignee.full_name}</span>}
                    {task.due_date && <span>· Due {format(new Date(task.due_date), "MMM d")}</span>}
                    {completedBy && <span>· ✓ {completedBy.full_name}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="px-5 py-3 border-t space-y-2">
          <input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="New task…"
            className="w-full h-8 px-3 text-sm rounded-md border bg-background"
          />
          <div className="flex gap-2">
            <select
              value={newTaskRoomGroup}
              onChange={(e) => setNewTaskRoomGroup(e.target.value)}
              className="flex-1 h-8 px-2 text-xs rounded-md border bg-background"
            >
              <option value="">No group</option>
              {roomGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select
              value={newTaskRoom}
              onChange={(e) => setNewTaskRoom(e.target.value)}
              className="flex-1 h-8 px-2 text-xs rounded-md border bg-background"
            >
              <option value="">No specific room</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select
              value={newTaskAssignee}
              onChange={(e) => setNewTaskAssignee(e.target.value)}
              className="flex-1 h-8 px-2 text-xs rounded-md border bg-background"
            >
              <option value="">Unassigned</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
            <button onClick={addTask} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
              Add
            </button>
          </div>
        </div>
      </section>
    </div>
    </div>
  );
}
