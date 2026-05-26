"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Project, Room, Task, Phase, Profile } from "@/lib/types";
import { format } from "date-fns";

interface Props {
  project: Project;
  initialRooms: Room[];
  initialTasks: Task[];
  phases: Phase[];
  profiles: Pick<Profile, "id" | "full_name">[];
}

export function ProjectDetailClient({ project, initialRooms, initialTasks, phases, profiles }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [rooms, setRooms] = useState(initialRooms);
  const [tasks, setTasks] = useState(initialTasks);
  const [newRoomName, setNewRoomName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskRoom, setNewTaskRoom] = useState<string>("");
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>("");

  const phaseMap = new Map(phases.map((p) => [p.id, p]));
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

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
    if (!error && data) {
      setRooms([...rooms, data as Room]);
      setNewRoomName("");
    }
  }

  async function changeRoomPhase(roomId: string, phaseId: string) {
    const { error } = await supabase
      .from("rooms")
      .update({ current_phase_id: phaseId })
      .eq("id", roomId);
    if (!error) {
      setRooms(rooms.map((r) => (r.id === roomId ? { ...r, current_phase_id: phaseId } : r)));
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

  return (
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
            const phase = room.current_phase_id ? phaseMap.get(room.current_phase_id) : null;
            return (
              <li key={room.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{room.name}</div>
                  {room.notes && <div className="text-xs text-muted-foreground mt-0.5">{room.notes}</div>}
                </div>
                <select
                  value={room.current_phase_id || ""}
                  onChange={(e) => changeRoomPhase(room.id, e.target.value)}
                  className="h-7 px-2 text-xs rounded-md border bg-background"
                  style={phase ? { color: phase.color, borderColor: `${phase.color}50` } : {}}
                >
                  <option value="">— no phase —</option>
                  {phases.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
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
  );
}
