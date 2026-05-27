"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "vaul";
import { createClient } from "@/lib/supabase/client";
import { FolderKanban, CheckSquare, DoorOpen } from "lucide-react";
import type { FabDrawerMode } from "@/components/mobile-fab";

type DrawerView = FabDrawerMode | "add-room";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: FabDrawerMode;
  projectId?: string;
}

export function MobileFabDrawer({ open, onOpenChange, mode: initialMode, projectId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [view, setView] = useState<DrawerView>(initialMode);

  // Quick task form state
  const [title, setTitle] = useState("");
  const [taskProjectId, setTaskProjectId] = useState(projectId || "");
  const [taskRoomGroupId, setTaskRoomGroupId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Add room form state
  const [roomName, setRoomName] = useState("");

  // Options loaded from Supabase
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>([]);
  const [roomGroups, setRoomGroups] = useState<{ id: string; name: string }[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  // Reset state when drawer opens
  useEffect(() => {
    if (open) {
      setView(initialMode);
      setTitle("");
      setRoomName("");
      setDueDate("");
      setAssignee("");
      setTaskProjectId(projectId || "");
      setTaskRoomGroupId("");
      setSaving(false);
    }
  }, [open, initialMode, projectId]);

  // Load project/profile options when needed
  useEffect(() => {
    if (!open || optionsLoaded) return;
    Promise.all([
      supabase
        .from("projects")
        .select("id, name")
        .in("status", ["planning", "active"])
        .order("name"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
    ]).then(([{ data: p }, { data: pr }]) => {
      setProjects(p || []);
      setProfiles(pr || []);
      setOptionsLoaded(true);
    });
  }, [open, optionsLoaded, supabase]);

  // Load room groups when project selection changes
  useEffect(() => {
    if (!taskProjectId) { setRoomGroups([]); return; }
    supabase.from("room_groups").select("id, name").eq("project_id", taskProjectId).order("sort_order")
      .then(({ data }) => setRoomGroups(data || []));
  }, [taskProjectId, supabase]);

  async function addTask() {
    if (!title.trim() || saving) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const isPersonal = !taskProjectId;
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(),
      project_id: taskProjectId || null,
      room_id: null,
      room_group_id: taskRoomGroupId || null,
      assigned_to: isPersonal ? user.id : assignee || null,
      due_date: dueDate || null,
      created_by: user.id,
    });

    setSaving(false);
    if (!error) {
      onOpenChange(false);
      router.refresh();
    }
  }

  async function addRoom() {
    if (!roomName.trim() || !projectId || saving) return;
    setSaving(true);

    const { data: phase } = await supabase
      .from("phases")
      .select("id")
      .eq("is_default", true)
      .is("archived_at", null)
      .maybeSingle();

    const { data: existingRooms } = await supabase
      .from("rooms")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = (existingRooms?.[0]?.sort_order ?? -1) + 1;

    const { error } = await supabase.from("rooms").insert({
      project_id: projectId,
      name: roomName.trim(),
      sort_order: nextOrder,
      current_phase_id: phase?.id || null,
    });

    setSaving(false);
    if (!error) {
      onOpenChange(false);
      router.refresh();
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed bottom-0 inset-x-0 z-50 rounded-t-xl bg-background">
          <div className="mx-auto w-12 h-1.5 shrink-0 rounded-full bg-muted-foreground/20 my-3" />
          <div className="px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">

            {/* Dashboard picker */}
            {view === "dashboard-picker" && (
              <div className="space-y-2">
                <Drawer.Title className="text-base font-semibold mb-3">Quick add</Drawer.Title>
                <button
                  onClick={() => {
                    onOpenChange(false);
                    router.push("/projects/new");
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
                >
                  <FolderKanban size={20} className="text-muted-foreground shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-medium">New project</div>
                    <div className="text-xs text-muted-foreground">
                      Create a new project with rooms
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setView("quick-task")}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
                >
                  <CheckSquare size={20} className="text-muted-foreground shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-medium">New task</div>
                    <div className="text-xs text-muted-foreground">
                      Add a task or personal todo
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Project detail picker */}
            {view === "project-picker" && (
              <div className="space-y-2">
                <Drawer.Title className="text-base font-semibold mb-3">
                  Add to project
                </Drawer.Title>
                <button
                  onClick={() => setView("add-room")}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
                >
                  <DoorOpen size={20} className="text-muted-foreground shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Add room</div>
                    <div className="text-xs text-muted-foreground">
                      Add a new room to this project
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setTaskProjectId(projectId || "");
                    setView("quick-task");
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
                >
                  <CheckSquare size={20} className="text-muted-foreground shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Add task</div>
                    <div className="text-xs text-muted-foreground">
                      Create a task for this project
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Quick task form */}
            {view === "quick-task" && (
              <div className="space-y-3">
                <Drawer.Title className="text-base font-semibold">New task</Drawer.Title>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                  placeholder="What needs to be done?"
                  className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  autoFocus
                />
                <select
                  value={taskProjectId}
                  onChange={(e) => setTaskProjectId(e.target.value)}
                  className="w-full h-10 px-2 text-sm rounded-md border bg-background"
                >
                  <option value="">Personal todo</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {roomGroups.length > 0 && (
                  <select
                    value={taskRoomGroupId}
                    onChange={(e) => setTaskRoomGroupId(e.target.value)}
                    className="w-full h-10 px-2 text-sm rounded-md border bg-background"
                  >
                    <option value="">No group</option>
                    {roomGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    className="h-10 px-2 text-sm rounded-md border bg-background"
                    disabled={!taskProjectId}
                  >
                    <option value="">
                      {taskProjectId ? "Unassigned" : "Assigned to you"}
                    </option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-10 px-2 text-sm rounded-md border bg-background"
                  />
                </div>
                <button
                  onClick={addTask}
                  disabled={!title.trim() || saving}
                  className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Adding…" : "Add task"}
                </button>
              </div>
            )}

            {/* Add room form */}
            {view === "add-room" && (
              <div className="space-y-3">
                <Drawer.Title className="text-base font-semibold">Add room</Drawer.Title>
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addRoom()}
                  placeholder="e.g. Main Kitchen, Pantry"
                  className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  autoFocus
                />
                <button
                  onClick={addRoom}
                  disabled={!roomName.trim() || saving}
                  className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Adding…" : "Add room"}
                </button>
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
