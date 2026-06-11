"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "vaul";
import { createClient } from "@/lib/supabase/client";
import { FolderKanban, CheckSquare, DoorOpen, CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import type { FabDrawerMode } from "@/components/mobile-fab";

type DrawerView = FabDrawerMode | "add-room";

type EventTypeOption = { id: string; name: string; color: string };
type TaskTypeOption = { id: string; name: string; color: string };
type TemplateOption = { id: string; name: string; items: string[] };

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
  const [taskRoomId, setTaskRoomId] = useState("");
  const [taskTypeId, setTaskTypeId] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [saving, setSaving] = useState(false);

  // Quick event form state
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTypeId, setEventTypeId] = useState("");
  const [eventProjectId, setEventProjectId] = useState(projectId || "");
  const [eventRoomGroupId, setEventRoomGroupId] = useState("");
  const [eventNotes, setEventNotes] = useState("");

  // Add room form state
  const [roomName, setRoomName] = useState("");

  // Current user ID (for default assignment)
  const [currentUserId, setCurrentUserId] = useState("");

  // Options loaded from Supabase
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>([]);
  const [roomGroups, setRoomGroups] = useState<{ id: string; name: string }[]>([]);
  const [taskRooms, setTaskRooms] = useState<{ id: string; name: string; room_group_id: string | null }[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskTypeOption[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TemplateOption[]>([]);
  const [eventTypes, setEventTypes] = useState<EventTypeOption[]>([]);
  const [eventRoomGroups, setEventRoomGroups] = useState<{ id: string; name: string }[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  // Scroll container + keyboard-aware height (mirrors SlidePanel)
  const scrollRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState("85vh");

  // Shrink the drawer to the visible viewport when the mobile keyboard opens,
  // so lower inputs and the submit button stay reachable above the keyboard.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    function onResize() {
      if (!vv) return;
      setMaxHeight(`${vv.height - 12}px`);
    }
    onResize();
    vv.addEventListener("resize", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      setMaxHeight("85vh");
    };
  }, [open]);

  // When an input/select inside the drawer gains focus, scroll it into view
  // once the keyboard has finished animating.
  useEffect(() => {
    if (!open) return;
    function onFocusIn(e: FocusEvent) {
      const target = e.target as HTMLElement;
      if (!scrollRef.current?.contains(target)) return;
      setTimeout(() => {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 150);
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [open]);

  // Reset state when drawer opens
  useEffect(() => {
    if (open) {
      setView(initialMode);
      setTitle("");
      setRoomName("");
      setDueDate("");
      setAssignee(currentUserId);
      setTaskProjectId(projectId || "");
      setTaskRoomGroupId("");
      setTaskRoomId("");
      setTaskTypeId("");
      setTaskNotes("");
      setSubtasks([]);
      setNewSubtask("");
      setEventTitle("");
      setEventDate(format(new Date(), "yyyy-MM-dd"));
      setEventTypeId("");
      setEventProjectId(projectId || "");
      setEventRoomGroupId("");
      setEventNotes("");
      setSaving(false);
    }
  }, [open, initialMode, projectId]);

  // Load project/profile/event-type options when needed
  useEffect(() => {
    if (!open || optionsLoaded) return;
    Promise.all([
      supabase
        .from("projects")
        .select("id, name")
        .in("status", ["planning", "active"])
        .order("name"),
      supabase.from("profiles").select("id, full_name").is("deactivated_at", null).order("full_name"),
      supabase
        .from("event_types")
        .select("id, name, color")
        .is("archived_at", null)
        .order("sort_order"),
      supabase
        .from("task_types")
        .select("id, name, color")
        .is("archived_at", null)
        .order("sort_order"),
      supabase.from("task_templates").select("id, name, items").order("sort_order"),
      supabase.auth.getUser(),
    ]).then(([{ data: p }, { data: pr }, { data: et }, { data: tt }, { data: tpl }, { data: { user } }]) => {
      setProjects(p || []);
      setProfiles(pr || []);
      setEventTypes(et || []);
      setTaskTypes(tt || []);
      setTaskTemplates((tpl as TemplateOption[]) || []);
      const uid = user?.id || "";
      setCurrentUserId(uid);
      setAssignee(uid);
      setOptionsLoaded(true);
    });
  }, [open, optionsLoaded, supabase]);

  // Load room groups and rooms when task project selection changes
  useEffect(() => {
    if (!taskProjectId) { setRoomGroups([]); setTaskRooms([]); setTaskRoomGroupId(""); setTaskRoomId(""); return; }
    Promise.all([
      supabase.from("room_groups").select("id, name").eq("project_id", taskProjectId).order("sort_order"),
      supabase.from("rooms").select("id, name, room_group_id").eq("project_id", taskProjectId).order("sort_order"),
    ]).then(([{ data: rg }, { data: r }]) => {
      setRoomGroups(rg || []);
      setTaskRooms(r || []);
    });
  }, [taskProjectId, supabase]);

  // Load room groups when event project selection changes
  useEffect(() => {
    if (!eventProjectId) { setEventRoomGroups([]); setEventRoomGroupId(""); return; }
    supabase.from("room_groups").select("id, name").eq("project_id", eventProjectId).order("sort_order")
      .then(({ data }) => setEventRoomGroups(data || []));
  }, [eventProjectId, supabase]);

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
    const tpl = taskTemplates.find((t) => t.id === templateId);
    if (!tpl || tpl.items.length === 0) return;
    setSubtasks((prev) => [...prev, ...tpl.items]);
  }

  async function addTask() {
    if (!title.trim() || saving) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data: task, error } = await supabase.from("tasks").insert({
      title: title.trim(),
      description: taskNotes.trim() || null,
      project_id: taskProjectId || null,
      room_id: taskRoomId || null,
      room_group_id: taskRoomGroupId || null,
      task_type_id: taskTypeId || null,
      assigned_to: assignee || null,
      due_date: dueDate || null,
      created_by: user.id,
    }).select("id").single();

    if (error || !task) {
      setSaving(false);
      return;
    }

    // Insert subtasks (checklist items) for the new task, if any.
    const items = subtasks.map((s) => s.trim()).filter(Boolean);
    if (items.length > 0) {
      await supabase.from("task_checklist_items").insert(
        items.map((title, i) => ({ task_id: task.id, title, sort_order: i }))
      );
    }

    setSaving(false);
    onOpenChange(false);
    router.refresh();
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

  async function addEvent() {
    if (!eventTitle.trim() || !eventDate || saving) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error } = await supabase.from("calendar_events").insert({
      title: eventTitle.trim(),
      event_date: eventDate,
      event_type_id: eventTypeId || null,
      project_id: eventProjectId || null,
      room_group_id: eventRoomGroupId || null,
      notes: eventNotes.trim() || null,
      created_by: user.id,
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
        <Drawer.Content
          style={{ maxHeight }}
          className="fixed bottom-0 inset-x-0 z-50 rounded-t-xl bg-background flex flex-col transition-[max-height] duration-150 ease-out"
        >
          <div className="mx-auto w-12 h-1.5 shrink-0 rounded-full bg-muted-foreground/20 my-3" />
          <div ref={scrollRef} className="px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] overflow-y-auto flex-1">

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
                <button
                  onClick={() => setView("quick-event")}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
                >
                  <CalendarPlus size={20} className="text-muted-foreground shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Add event</div>
                    <div className="text-xs text-muted-foreground">
                      Add a calendar event
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
                <button
                  onClick={() => {
                    setEventProjectId(projectId || "");
                    setView("quick-event");
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
                >
                  <CalendarPlus size={20} className="text-muted-foreground shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Add event</div>
                    <div className="text-xs text-muted-foreground">
                      Add a calendar event
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
                {taskTypes.length > 0 && (
                  <select
                    value={taskTypeId}
                    onChange={(e) => setTaskTypeId(e.target.value)}
                    className="w-full h-10 px-2 text-sm rounded-md border bg-background"
                  >
                    <option value="">No type</option>
                    {taskTypes.map((tt) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
                  </select>
                )}
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-10 px-2 text-sm rounded-md border bg-background"
                />
                <select
                  value={taskProjectId}
                  onChange={(e) => { setTaskProjectId(e.target.value); setTaskRoomGroupId(""); setTaskRoomId(""); if (!e.target.value) setAssignee(""); }}
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
                    onChange={(e) => { setTaskRoomGroupId(e.target.value); setTaskRoomId(""); }}
                    className="w-full h-10 px-2 text-sm rounded-md border bg-background"
                  >
                    <option value="">No group</option>
                    {roomGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
                {(() => {
                  const filtered = taskRoomGroupId ? taskRooms.filter((r) => r.room_group_id === taskRoomGroupId) : taskRooms;
                  return filtered.length > 0 ? (
                    <select
                      value={taskRoomId}
                      onChange={(e) => setTaskRoomId(e.target.value)}
                      className="w-full h-10 px-2 text-sm rounded-md border bg-background"
                    >
                      <option value="">No room</option>
                      {filtered.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  ) : null;
                })()}
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="w-full h-10 px-2 text-sm rounded-md border bg-background"
                  disabled={!taskProjectId}
                >
                  <option value="">Unassigned</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
                <input
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                />

                {/* Subtasks */}
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Subtasks
                  </div>
                  {taskTemplates.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) applyTemplate(e.target.value);
                        e.target.value = "";
                      }}
                      className="w-full h-10 px-2 text-sm text-muted-foreground rounded-md border bg-background"
                    >
                      <option value="">Add from template…</option>
                      {taskTemplates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                      ))}
                    </select>
                  )}
                  {subtasks.length > 0 && (
                    <ul className="space-y-1">
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
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSubtask();
                        }
                      }}
                      placeholder="Add a subtask…"
                      className="flex-1 h-10 px-3 text-sm rounded-md border bg-background"
                    />
                    <button
                      type="button"
                      onClick={addSubtask}
                      disabled={!newSubtask.trim()}
                      className="h-10 px-3 text-sm font-medium rounded-md border bg-background hover:bg-muted disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
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

            {/* Quick event form */}
            {view === "quick-event" && (
              <div className="space-y-3">
                <Drawer.Title className="text-base font-semibold">Add event</Drawer.Title>
                <input
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addEvent()}
                  placeholder="e.g. Template day, Worktop install"
                  className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="h-10 px-2 text-sm rounded-md border bg-background"
                  />
                  <select
                    value={eventTypeId}
                    onChange={(e) => setEventTypeId(e.target.value)}
                    className="h-10 px-2 text-sm rounded-md border bg-background"
                  >
                    <option value="">No type</option>
                    {eventTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <select
                  value={eventProjectId}
                  onChange={(e) => { setEventProjectId(e.target.value); setEventRoomGroupId(""); }}
                  className="w-full h-10 px-2 text-sm rounded-md border bg-background"
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {eventRoomGroups.length > 0 && (
                  <select
                    value={eventRoomGroupId}
                    onChange={(e) => setEventRoomGroupId(e.target.value)}
                    className="w-full h-10 px-2 text-sm rounded-md border bg-background"
                  >
                    <option value="">No room group</option>
                    {eventRoomGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                )}
                <input
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                />
                <button
                  onClick={addEvent}
                  disabled={!eventTitle.trim() || !eventDate || saving}
                  className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Adding…" : "Add event"}
                </button>
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
