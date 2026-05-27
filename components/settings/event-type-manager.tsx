"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Popover from "@radix-ui/react-popover";
import {
  GripVertical,
  Archive,
  RotateCcw,
  Plus,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { EventType } from "@/lib/types";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#14b8a6", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#d946ef", "#ec4899", "#f43f5e", "#78716c",
];

interface Props {
  initialEventTypes: EventType[];
  isAdmin: boolean;
}

/* ── Sortable row ── */

function SortableEventTypeRow({
  eventType,
  editing,
  onNameChange,
  onNameBlur,
  onColorChange,
  onArchive,
}: {
  eventType: EventType;
  editing: boolean;
  onNameChange: (id: string, name: string) => void;
  onNameBlur: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  onArchive: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: eventType.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  if (!editing) {
    return (
      <li className="px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: eventType.color }}
          />
          <span className="text-sm font-medium">{eventType.name}</span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          #{eventType.sort_order}
        </span>
      </li>
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="px-5 py-2.5 flex items-center gap-2 bg-background"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
      >
        <GripVertical size={16} />
      </button>

      {/* Colour picker */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            className="w-6 h-6 rounded-full shrink-0 ring-1 ring-border hover:ring-foreground transition-shadow"
            style={{ backgroundColor: eventType.color }}
            title="Change colour"
          />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="z-50 rounded-lg border bg-popover p-3 shadow-md"
            sideOffset={8}
            align="start"
          >
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onColorChange(eventType.id, c)}
                  className="w-6 h-6 rounded-full ring-1 ring-border hover:scale-110 transition-transform flex items-center justify-center"
                  style={{ backgroundColor: c }}
                >
                  {c === eventType.color && (
                    <Check size={12} className="text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
            <Popover.Arrow className="fill-border" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Name input */}
      <input
        value={eventType.name}
        onChange={(e) => onNameChange(eventType.id, e.target.value)}
        onBlur={() => onNameBlur(eventType.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="flex-1 h-8 px-2 text-sm rounded-md border bg-background min-w-0"
      />

      {/* Archive button */}
      <button
        onClick={() => onArchive(eventType.id)}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        title="Archive event type"
      >
        <Archive size={16} />
      </button>
    </li>
  );
}

/* ── Main component ── */

export function EventTypeManager({ initialEventTypes, isAdmin }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [types, setTypes] = useState<EventType[]>(
    initialEventTypes.filter((t) => !t.archived_at)
  );
  const [archivedTypes, setArchivedTypes] = useState<EventType[]>(
    initialEventTypes.filter((t) => !!t.archived_at)
  );
  const [showArchived, setShowArchived] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  /* ── Name editing ── */

  const handleNameChange = useCallback((id: string, name: string) => {
    setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
  }, []);

  const handleNameBlur = useCallback(
    async (id: string) => {
      const et = types.find((t) => t.id === id);
      if (!et || !et.name.trim()) return;
      await supabase
        .from("event_types")
        .update({ name: et.name.trim() })
        .eq("id", id);
    },
    [types, supabase]
  );

  /* ── Colour change ── */

  const handleColorChange = useCallback(
    async (id: string, color: string) => {
      setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, color } : t)));
      await supabase.from("event_types").update({ color }).eq("id", id);
    },
    [supabase]
  );

  /* ── Drag reorder ── */

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = types.findIndex((t) => t.id === active.id);
    const newIndex = types.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(types, oldIndex, newIndex).map((t, i) => ({
      ...t,
      sort_order: i,
    }));
    setTypes(reordered);

    await Promise.all(
      reordered.map((t, i) =>
        supabase.from("event_types").update({ sort_order: i }).eq("id", t.id)
      )
    );
  }

  /* ── Add event type ── */

  async function handleAdd() {
    const maxOrder = types.reduce((max, t) => Math.max(max, t.sort_order), -1);
    const randomColor =
      PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];

    const { data, error } = await supabase
      .from("event_types")
      .insert({
        name: "New type",
        sort_order: maxOrder + 1,
        color: randomColor,
      })
      .select("*")
      .single();

    if (!error && data) {
      setTypes([...types, data as EventType]);
    }
  }

  /* ── Archive event type ── */

  const handleArchive = useCallback(
    async (id: string) => {
      const et = types.find((t) => t.id === id);
      if (!et) return;

      const { count } = await supabase
        .from("calendar_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type_id", id);

      if (count && count > 0) {
        const proceed = confirm(
          `${count} event${count !== 1 ? "s use" : " uses"} the "${et.name}" type. Archiving won't remove them, but this type won't be available for new events. Archive anyway?`
        );
        if (!proceed) return;
      }

      const { error } = await supabase
        .from("event_types")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);

      if (!error) {
        const archived = { ...et, archived_at: new Date().toISOString() };
        setTypes((prev) => prev.filter((t) => t.id !== id));
        setArchivedTypes((prev) => [...prev, archived]);
      }
    },
    [types, supabase]
  );

  /* ── Restore event type ── */

  async function handleRestore(id: string) {
    const et = archivedTypes.find((t) => t.id === id);
    if (!et) return;

    const maxOrder = types.reduce((max, t) => Math.max(max, t.sort_order), -1);

    const { error } = await supabase
      .from("event_types")
      .update({ archived_at: null, sort_order: maxOrder + 1 })
      .eq("id", id);

    if (!error) {
      const restored = { ...et, archived_at: null, sort_order: maxOrder + 1 };
      setArchivedTypes((prev) => prev.filter((t) => t.id !== id));
      setTypes((prev) => [...prev, restored as EventType]);
    }
  }

  /* ── Done editing ── */

  function handleDone() {
    setEditing(false);
    router.refresh();
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3.5 border-b flex items-center justify-between">
        <h2 className="font-medium">{editing ? "Edit event types" : "Event types"}</h2>
        {isAdmin && (
          <button
            onClick={editing ? handleDone : () => setEditing(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {editing ? "Done" : "Edit types"}
          </button>
        )}
      </div>

      {types.length === 0 && !editing && (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          No event types yet. {isAdmin && "Click \"Edit types\" to add some."}
        </div>
      )}

      {editing ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={types.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="divide-y">
              {types.map((et) => (
                <SortableEventTypeRow
                  key={et.id}
                  eventType={et}
                  editing
                  onNameChange={handleNameChange}
                  onNameBlur={handleNameBlur}
                  onColorChange={handleColorChange}
                  onArchive={handleArchive}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <ul className="divide-y">
          {types.map((et) => (
            <SortableEventTypeRow
              key={et.id}
              eventType={et}
              editing={false}
              onNameChange={() => {}}
              onNameBlur={() => {}}
              onColorChange={() => {}}
              onArchive={() => {}}
            />
          ))}
        </ul>
      )}

      {/* Add type button */}
      {editing && (
        <div className="px-5 py-3 border-t">
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Plus size={14} />
            Add event type
          </button>
        </div>
      )}

      {/* Archived section */}
      {editing && archivedTypes.length > 0 && (
        <div className="border-t">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="w-full px-5 py-3 flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Archived ({archivedTypes.length})
          </button>
          {showArchived && (
            <ul className="divide-y border-t">
              {archivedTypes.map((et) => (
                <li
                  key={et.id}
                  className="px-5 py-3 flex items-center justify-between opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: et.color }}
                    />
                    <span className="text-sm">{et.name}</span>
                  </div>
                  <button
                    onClick={() => handleRestore(et.id)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <RotateCcw size={12} />
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
