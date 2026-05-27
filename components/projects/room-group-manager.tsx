"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { RoomGroup } from "@/lib/types";

interface Props {
  projectId: string;
  initialGroups: RoomGroup[];
  roomCountMap: Record<string, number>; // group_id → room count
}

function SortableGroupRow({
  group,
  roomCount,
  onRename,
  onDelete,
}: {
  group: RoomGroup;
  roomCount: number;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  function save() {
    if (name.trim() && name.trim() !== group.name) {
      onRename(group.id, name.trim());
    }
    setEditing(false);
  }

  return (
    <li ref={setNodeRef} style={style} className="px-4 py-2.5 flex items-center gap-2 group">
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/>
          <circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>
        </svg>
      </button>
      {editing ? (
        <div className="flex-1 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            className="flex-1 h-7 px-2 text-sm rounded-md border bg-background"
            autoFocus
          />
          <button onClick={save} className="h-7 px-2 rounded-md bg-primary text-primary-foreground text-xs font-medium">Save</button>
          <button onClick={() => { setName(group.name); setEditing(false); }} className="h-7 px-2 rounded-md border text-xs">Cancel</button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-sm font-medium">{group.name}</span>
          <span className="text-xs text-muted-foreground">{roomCount} room{roomCount !== 1 ? "s" : ""}</span>
          <button
            onClick={() => setEditing(true)}
            className="h-6 w-6 rounded grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
            title="Rename"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(group.id)}
            className="h-6 w-6 rounded grid place-items-center text-muted-foreground hover:text-destructive hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete group"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
          </button>
        </>
      )}
    </li>
  );
}

export function RoomGroupManager({ projectId, initialGroups, roomCountMap }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [groups, setGroups] = useState(initialGroups);
  const [newName, setNewName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  async function addGroup() {
    if (!newName.trim()) return;
    const { data, error } = await supabase
      .from("room_groups")
      .insert({ project_id: projectId, name: newName.trim(), sort_order: groups.length })
      .select("*")
      .single();
    if (!error && data) {
      setGroups([...groups, data as RoomGroup]);
      setNewName("");
    }
  }

  async function renameGroup(id: string, name: string) {
    const { error } = await supabase.from("room_groups").update({ name }).eq("id", id);
    if (!error) {
      setGroups(groups.map((g) => (g.id === id ? { ...g, name } : g)));
    }
  }

  async function deleteGroup(id: string) {
    const count = roomCountMap[id] || 0;
    const msg = count > 0
      ? `Delete "${groups.find((g) => g.id === id)?.name}"? Its ${count} room(s) will become ungrouped.`
      : `Delete "${groups.find((g) => g.id === id)?.name}"?`;
    if (!confirm(msg)) return;
    const { error } = await supabase.from("room_groups").delete().eq("id", id);
    if (!error) {
      setGroups(groups.filter((g) => g.id !== id));
      router.refresh();
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = groups.findIndex((g) => g.id === active.id);
    const newIndex = groups.findIndex((g) => g.id === over.id);
    const reordered = arrayMove(groups, oldIndex, newIndex).map((g, i) => ({
      ...g,
      sort_order: i,
    }));
    setGroups(reordered);
    await Promise.all(
      reordered.map((g, i) =>
        supabase.from("room_groups").update({ sort_order: i }).eq("id", g.id)
      )
    );
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3.5 border-b">
        <h2 className="font-medium">Room groups</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Group rooms by installation batch (delivered and installed together).
        </p>
      </div>
      {groups.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y">
              {groups.map((g) => (
                <SortableGroupRow
                  key={g.id}
                  group={g}
                  roomCount={roomCountMap[g.id] || 0}
                  onRename={renameGroup}
                  onDelete={deleteGroup}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="px-5 py-6 text-sm text-muted-foreground text-center">
          No groups yet. Create one to batch rooms for installation.
        </div>
      )}
      <div className="px-4 py-3 border-t flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addGroup()}
          placeholder="New group (e.g. Kitchen Install)"
          className="flex-1 h-8 px-3 text-sm rounded-md border bg-background"
        />
        <button onClick={addGroup} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
          Add
        </button>
      </div>
    </section>
  );
}
