"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { Trash2, Plus, X } from "lucide-react";
import { SlidePanel } from "@/components/ui/slide-panel";

interface ChecklistSummaryItem {
  id: string;
  completed_at: string | null;
}

interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  completed_at: string | null;
  completed_by: string | null;
  sort_order: number;
  created_at: string;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: number;
  sort_order: number;
  project_id: string | null;
  room_id: string | null;
  room_group_id: string | null;
  task_type_id: string | null;
  assigned_to: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  created_at: string;
  projects: { name: string } | null;
  rooms: { name: string } | null;
  room_groups: { name: string } | null;
  task_types: { id: string; name: string; color: string } | null;
  assignee: { full_name: string } | null;
  completer: { full_name: string } | null;
  task_checklist_items: ChecklistSummaryItem[] | null;
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

interface TaskDetailPanelProps {
  task: TaskRow | null;
  profiles: ProfileOption[];
  taskTypes: TaskTypeOption[];
  templates?: TemplateOption[];
  userId: string;
  onClose: () => void;
  onUpdated: (task: TaskRow) => void;
  onDeleted: (id: string) => void;
  onToggleComplete: (task: TaskRow) => void;
  onChecklistChange?: (taskId: string, items: ChecklistSummaryItem[]) => void;
}

export function TaskDetailPanel({
  task, profiles, taskTypes, templates = [], userId, onClose, onUpdated, onDeleted, onToggleComplete, onChecklistChange,
}: TaskDetailPanelProps) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [roomGroupId, setRoomGroupId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [taskTypeId, setTaskTypeId] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [applyingTemplate, setApplyingTemplate] = useState(false);

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
    setTaskTypeId(task.task_type_id || "");
    setShowDeleteConfirm(false);
    setNewItem("");
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load checklist items when task changes
  useEffect(() => {
    if (!task) {
      setChecklist([]);
      return;
    }
    supabase
      .from("task_checklist_items")
      .select("*")
      .eq("task_id", task.id)
      .order("sort_order")
      .order("created_at")
      .then(({ data }) => setChecklist((data as ChecklistItem[]) || []));
  }, [task?.id, supabase]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const selectStr = "*, projects(name), rooms(name), room_groups(name), task_types(id,name,color), assignee:assigned_to(full_name), completer:completed_by(full_name), task_checklist_items(id, completed_at)";

  // Push checklist summary to parent so list badges stay in sync.
  function syncChecklist(items: ChecklistItem[]) {
    if (task) onChecklistChange?.(task.id, items.map((i) => ({ id: i.id, completed_at: i.completed_at })));
  }

  async function addChecklistItem() {
    const title = newItem.trim();
    if (!task || !title) return;
    const sort = checklist.length ? Math.max(...checklist.map((i) => i.sort_order)) + 1 : 0;
    const { data, error } = await supabase
      .from("task_checklist_items")
      .insert({ task_id: task.id, title, sort_order: sort })
      .select("*")
      .single();
    if (!error && data) {
      const next = [...checklist, data as ChecklistItem];
      setChecklist(next);
      syncChecklist(next);
      setNewItem("");
    }
  }

  async function toggleChecklistItem(item: ChecklistItem) {
    const updates = item.completed_at
      ? { completed_at: null, completed_by: null }
      : { completed_at: new Date().toISOString(), completed_by: userId };
    const { data, error } = await supabase
      .from("task_checklist_items")
      .update(updates)
      .eq("id", item.id)
      .select("*")
      .single();
    if (!error && data) {
      const next = checklist.map((i) => (i.id === item.id ? (data as ChecklistItem) : i));
      setChecklist(next);
      syncChecklist(next);
    }
  }

  async function deleteChecklistItem(id: string) {
    const { error } = await supabase.from("task_checklist_items").delete().eq("id", id);
    if (!error) {
      const next = checklist.filter((i) => i.id !== id);
      setChecklist(next);
      syncChecklist(next);
    }
  }

  async function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!task || !tpl || tpl.items.length === 0) return;
    setApplyingTemplate(true);
    const base = checklist.length ? Math.max(...checklist.map((i) => i.sort_order)) + 1 : 0;
    const rows = tpl.items.map((title, i) => ({ task_id: task.id, title, sort_order: base + i }));
    const { data, error } = await supabase
      .from("task_checklist_items")
      .insert(rows)
      .select("*");
    setApplyingTemplate(false);
    if (!error && data) {
      const next = [...checklist, ...(data as ChecklistItem[])];
      setChecklist(next);
      syncChecklist(next);
    }
  }

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
      showClose={false}
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

      {/* Task type */}
      {taskTypes.length > 0 && (
        <div className="mb-4">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Type
          </label>
          <select
            value={taskTypeId}
            onChange={(e) => {
              setTaskTypeId(e.target.value);
              autoSave("task_type_id", e.target.value);
            }}
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

      {/* Checklist */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Checklist
            {checklist.length > 0 && (
              <span className="ml-1.5 tabular-nums normal-case font-normal">
                {checklist.filter((i) => i.completed_at).length}/{checklist.length}
              </span>
            )}
          </label>
          {templates.length > 0 && (
            <select
              value=""
              disabled={applyingTemplate}
              onChange={(e) => {
                if (e.target.value) applyTemplate(e.target.value);
                e.target.value = "";
              }}
              className="h-7 px-2 rounded-md border bg-background text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">Apply template…</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
              ))}
            </select>
          )}
        </div>

        {checklist.length > 0 && (
          <ul className="space-y-1 mb-2">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-start gap-2 group">
                <input
                  type="checkbox"
                  checked={!!item.completed_at}
                  onChange={() => toggleChecklistItem(item)}
                  className="mt-0.5 size-3.5 rounded border-input cursor-pointer shrink-0"
                />
                <span className={`flex-1 text-sm ${item.completed_at ? "line-through text-muted-foreground" : ""}`}>
                  {item.title}
                </span>
                <button
                  onClick={() => deleteChecklistItem(item.id)}
                  className="shrink-0 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove checklist item"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addChecklistItem();
              }
            }}
            placeholder="Add checklist item…"
            className="flex-1 h-8 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={addChecklistItem}
            disabled={!newItem.trim()}
            className="h-8 w-8 grid place-items-center rounded-md border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40"
            aria-label="Add checklist item"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {/* Meta footer */}
      <div className="pt-3 border-t text-[11px] text-muted-foreground space-y-0.5">
        <div>{projectLabel}</div>
        <div>Created {format(new Date(task.created_at), "MMM d, yyyy")}{creatorName ? ` by ${creatorName}` : ""}</div>
        {task.completed_at && (
          <div>Completed {format(new Date(task.completed_at), "MMM d, yyyy")}{task.completer?.full_name ? ` by ${task.completer.full_name}` : ""}</div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="mt-6 space-y-3">
        {/* Delete with inline confirmation */}
        <div className="flex justify-center">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Delete this task?</span>
              <button
                onClick={handleDelete}
                className="px-3 h-7 rounded-md bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 h-7 rounded-md border text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 size={12} />
              Delete task
            </button>
          )}
        </div>

        {/* Complete button – open tasks only */}
        {!task.completed_at && (
          <button
            onClick={() => onToggleComplete(task)}
            className="w-full h-9 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-colors"
          >
            Complete
          </button>
        )}

        {/* Done button – closes the panel */}
        <button
          onClick={onClose}
          className="w-full h-9 rounded-md text-sm font-medium border hover:bg-muted transition-colors"
        >
          Done
        </button>
      </div>
    </SlidePanel>
  );
}
