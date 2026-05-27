"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
import type { Phase, Room, RoomGroup } from "@/lib/types";

interface Props {
  projectId: string;
  groups: RoomGroup[];
  rooms: Room[];
  phases: Phase[];
  onGroupsChange: (groups: RoomGroup[]) => void;
  onRoomsChange: (rooms: Room[]) => void;
}

/** Auto-generate a group name from its rooms */
function groupNameFromRooms(roomNames: string[]): string {
  if (roomNames.length === 0) return "New group";
  return roomNames.join(", ");
}

function SortableGroupRow({
  group,
  groupRooms,
  allRooms,
  phases,
  onDelete,
  onToggleRoom,
  onPhaseChange,
  isEditing,
  onStartEdit,
  onStopEdit,
}: {
  group: RoomGroup;
  groupRooms: Room[];
  allRooms: Room[];
  phases: Phase[];
  onDelete: (id: string) => void;
  onToggleRoom: (roomId: string, groupId: string | null) => void;
  onPhaseChange: (groupId: string, phaseId: string) => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  // Rooms available to add: unassigned OR already in this group
  const availableRooms = allRooms.filter(
    (r) => !r.room_group_id || r.room_group_id === group.id
  );

  return (
    <li ref={setNodeRef} style={style} className="px-4 py-2.5 group">
      <div className="flex items-center gap-2">
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
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{group.name}</span>
          {groupRooms.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {groupRooms.map((r) => (
                <span key={r.id} className="text-xs px-1.5 py-0.5 rounded bg-muted">
                  {r.name}
                </span>
              ))}
            </div>
          )}
        </div>
        {(() => {
          // Derive group phase from its rooms (all should match)
          const currentPhaseId = groupRooms.length > 0 ? groupRooms[0].current_phase_id : null;
          const currentPhase = currentPhaseId ? phases.find((p) => p.id === currentPhaseId) : null;
          return (
            <select
              value={currentPhaseId || ""}
              onChange={(e) => onPhaseChange(group.id, e.target.value)}
              className="h-7 px-2 text-xs rounded-md border bg-background shrink-0"
              style={currentPhase ? { color: currentPhase.color, borderColor: `${currentPhase.color}50` } : {}}
            >
              <option value="">— no phase —</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          );
        })()}
        <button
          onClick={isEditing ? onStopEdit : onStartEdit}
          className="h-6 w-6 rounded grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
          title="Edit rooms"
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
      </div>
      {isEditing && (
        <div className="mt-2 ml-6 space-y-1">
          <p className="text-xs text-muted-foreground mb-1.5">Select rooms for this group:</p>
          {availableRooms.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">All rooms are assigned to other groups.</p>
          ) : (
            availableRooms.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={r.room_group_id === group.id}
                  onChange={() =>
                    onToggleRoom(r.id, r.room_group_id === group.id ? null : group.id)
                  }
                  className="size-3.5 rounded border-input"
                />
                {r.name}
              </label>
            ))
          )}
          <button
            onClick={onStopEdit}
            className="mt-1 h-7 px-2 rounded-md border text-xs hover:bg-muted"
          >
            Done
          </button>
        </div>
      )}
    </li>
  );
}

export function RoomGroupManager({ projectId, groups, rooms, phases, onGroupsChange, onRoomsChange }: Props) {
  const supabase = createClient();
  const [creating, setCreating] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [newRoomNames, setNewRoomNames] = useState<string[]>([]);
  const [newRoomInput, setNewRoomInput] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Unassigned rooms (available for new group)
  const unassignedRooms = rooms.filter((r) => !r.room_group_id);

  function toggleRoomSelection(roomId: string) {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }

  function addNewRoomName() {
    const trimmed = newRoomInput.trim();
    if (!trimmed) return;
    if (newRoomNames.includes(trimmed)) return;
    setNewRoomNames([...newRoomNames, trimmed]);
    setNewRoomInput("");
  }

  function removeNewRoomName(name: string) {
    setNewRoomNames(newRoomNames.filter((n) => n !== name));
  }

  async function createGroup() {
    const existingSelected = rooms.filter((r) => selectedRoomIds.has(r.id));
    if (selectedRoomIds.size === 0 && newRoomNames.length === 0) return;

    // Compute group name from selected existing + new rooms
    const allNames = [
      ...existingSelected.map((r) => r.name),
      ...newRoomNames,
    ];
    const name = groupNameFromRooms(allNames);

    // Create the group
    const { data, error } = await supabase
      .from("room_groups")
      .insert({ project_id: projectId, name, sort_order: groups.length })
      .select("*")
      .single();
    if (error || !data) return;

    const newGroup = data as RoomGroup;
    const defaultPhase = phases.find((p) => p.is_default);

    // Create new rooms and assign to group
    let createdRooms: Room[] = [];
    if (newRoomNames.length > 0) {
      const { data: roomData } = await supabase
        .from("rooms")
        .insert(
          newRoomNames.map((rn, i) => ({
            project_id: projectId,
            name: rn,
            sort_order: rooms.length + i,
            room_group_id: newGroup.id,
            current_phase_id: defaultPhase?.id || null,
          }))
        )
        .select("*");
      if (roomData) createdRooms = roomData as Room[];
    }

    // Assign existing rooms to the group
    if (selectedRoomIds.size > 0) {
      await Promise.all(
        Array.from(selectedRoomIds).map((roomId) =>
          supabase.from("rooms").update({ room_group_id: newGroup.id }).eq("id", roomId)
        )
      );
    }

    const updatedRooms = [
      ...rooms.map((r) =>
        selectedRoomIds.has(r.id) ? { ...r, room_group_id: newGroup.id } : r
      ),
      ...createdRooms,
    ];

    onGroupsChange([...groups, newGroup]);
    onRoomsChange(updatedRooms);
    setSelectedRoomIds(new Set());
    setNewRoomNames([]);
    setNewRoomInput("");
    setCreating(false);
  }

  async function toggleRoomInGroup(roomId: string, groupId: string | null) {
    const { error } = await supabase
      .from("rooms")
      .update({ room_group_id: groupId })
      .eq("id", roomId);
    if (error) return;

    const oldGroupId = rooms.find((r) => r.id === roomId)?.room_group_id;
    const updatedRooms = rooms.map((r) =>
      r.id === roomId ? { ...r, room_group_id: groupId } : r
    );
    onRoomsChange(updatedRooms);

    // Update names of affected groups
    let updatedGroups = [...groups];
    const affectedGroupIds = [groupId, oldGroupId].filter(Boolean) as string[];
    for (const gid of affectedGroupIds) {
      const groupRooms = updatedRooms.filter((r) => r.room_group_id === gid);
      const newName = groupNameFromRooms(groupRooms.map((r) => r.name));
      await supabase.from("room_groups").update({ name: newName }).eq("id", gid);
      updatedGroups = updatedGroups.map((g) =>
        g.id === gid ? { ...g, name: newName } : g
      );
    }
    onGroupsChange(updatedGroups);
  }

  async function deleteGroup(id: string) {
    const groupRooms = rooms.filter((r) => r.room_group_id === id);
    const msg = groupRooms.length > 0
      ? `Delete this group? Its ${groupRooms.length} room(s) will become ungrouped.`
      : "Delete this group?";
    if (!confirm(msg)) return;
    const { error } = await supabase.from("room_groups").delete().eq("id", id);
    if (error) return;

    const updatedRooms = rooms.map((r) =>
      r.room_group_id === id ? { ...r, room_group_id: null } : r
    );
    onGroupsChange(groups.filter((g) => g.id !== id));
    onRoomsChange(updatedRooms);
  }

  async function changeGroupPhase(groupId: string, phaseId: string) {
    const groupRoomIds = rooms.filter((r) => r.room_group_id === groupId).map((r) => r.id);
    if (groupRoomIds.length === 0) return;

    // Update all rooms in the group to the new phase
    await Promise.all(
      groupRoomIds.map((roomId) =>
        supabase.from("rooms").update({ current_phase_id: phaseId || null }).eq("id", roomId)
      )
    );

    const updatedRooms = rooms.map((r) =>
      r.room_group_id === groupId ? { ...r, current_phase_id: phaseId || null } : r
    );
    onRoomsChange(updatedRooms);
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
    onGroupsChange(reordered);
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
          Group rooms by installation batch. Phases are scheduled per group.
        </p>
      </div>
      {groups.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y">
              {groups.map((g) => {
                const groupRooms = rooms.filter((r) => r.room_group_id === g.id);
                return (
                  <SortableGroupRow
                    key={g.id}
                    group={g}
                    groupRooms={groupRooms}
                    allRooms={rooms}
                    phases={phases}
                    onDelete={deleteGroup}
                    onToggleRoom={toggleRoomInGroup}
                    onPhaseChange={changeGroupPhase}
                    isEditing={editingGroupId === g.id}
                    onStartEdit={() => setEditingGroupId(g.id)}
                    onStopEdit={() => setEditingGroupId(null)}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="px-5 py-6 text-sm text-muted-foreground text-center">
          No groups yet. Create one to batch rooms for installation scheduling.
        </div>
      )}

      {/* Create new group */}
      {creating ? (
        <div className="px-4 py-3 border-t space-y-2">
          <p className="text-sm font-medium">Rooms for the new group:</p>

          {/* Existing unassigned rooms */}
          {unassignedRooms.length > 0 && (
            <div>
              {unassignedRooms.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                  <input
                    type="checkbox"
                    checked={selectedRoomIds.has(r.id)}
                    onChange={() => toggleRoomSelection(r.id)}
                    className="size-3.5 rounded border-input"
                  />
                  {r.name}
                </label>
              ))}
            </div>
          )}

          {/* New rooms to be created */}
          {newRoomNames.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {newRoomNames.map((n) => (
                <span key={n} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-muted">
                  {n}
                  <button
                    onClick={() => removeNewRoomName(n)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Add new room input */}
          <div className="flex gap-2">
            <input
              value={newRoomInput}
              onChange={(e) => setNewRoomInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNewRoomName()}
              placeholder="Add a room (e.g. Kitchen, Pantry)"
              className="flex-1 h-8 px-3 text-sm rounded-md border bg-background"
            />
            <button
              onClick={addNewRoomName}
              disabled={!newRoomInput.trim()}
              className="h-8 px-3 rounded-md border text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              + Room
            </button>
          </div>

          {/* Preview group name */}
          {(selectedRoomIds.size > 0 || newRoomNames.length > 0) && (
            <p className="text-xs text-muted-foreground">
              Group name: <span className="font-medium text-foreground">
                {groupNameFromRooms([
                  ...rooms.filter((r) => selectedRoomIds.has(r.id)).map((r) => r.name),
                  ...newRoomNames,
                ])}
              </span>
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={createGroup}
              disabled={selectedRoomIds.size === 0 && newRoomNames.length === 0}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              Create group
            </button>
            <button
              onClick={() => { setCreating(false); setSelectedRoomIds(new Set()); setNewRoomNames([]); setNewRoomInput(""); }}
              className="h-8 px-3 rounded-md border text-xs hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 border-t">
          <button
            onClick={() => setCreating(true)}
            className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
          >
            New group
          </button>
        </div>
      )}
    </section>
  );
}
