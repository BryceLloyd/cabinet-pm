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
import type { Phase } from "@/lib/types";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#14b8a6", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#d946ef", "#ec4899", "#f43f5e", "#78716c",
];

interface Props {
  initialPhases: Phase[];
  isAdmin: boolean;
}

/* ── Sortable row ── */

function SortablePhaseRow({
  phase,
  editing,
  onNameChange,
  onNameBlur,
  onColorChange,
  onDurationChange,
  onDurationBlur,
  onSetDefault,
  onArchive,
}: {
  phase: Phase;
  editing: boolean;
  onNameChange: (id: string, name: string) => void;
  onNameBlur: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  onDurationChange: (id: string, days: number | null) => void;
  onDurationBlur: (id: string) => void;
  onSetDefault: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: phase.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  if (!editing) {
    const durationLabel = phase.default_duration_days != null
      ? phase.default_duration_days >= 7 && phase.default_duration_days % 7 === 0
        ? `${phase.default_duration_days / 7}w`
        : `${phase.default_duration_days}d`
      : null;

    // Read-only row
    return (
      <li className="px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ backgroundColor: phase.color }}
          />
          <span className="text-sm font-medium">{phase.name}</span>
          {phase.is_default && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              default
            </span>
          )}
          {durationLabel && (
            <span className="text-xs text-muted-foreground">{durationLabel}</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          #{phase.sort_order}
        </span>
      </li>
    );
  }

  // Edit-mode row
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
            style={{ backgroundColor: phase.color }}
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
                  onClick={() => onColorChange(phase.id, c)}
                  className="w-6 h-6 rounded-full ring-1 ring-border hover:scale-110 transition-transform flex items-center justify-center"
                  style={{ backgroundColor: c }}
                >
                  {c === phase.color && (
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
        value={phase.name}
        onChange={(e) => onNameChange(phase.id, e.target.value)}
        onBlur={() => onNameBlur(phase.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="flex-1 h-8 px-2 text-sm rounded-md border bg-background min-w-0"
      />

      {/* Duration input */}
      <div className="shrink-0 flex items-center gap-1">
        <input
          type="number"
          min={0}
          placeholder="—"
          value={phase.default_duration_days ?? ""}
          onChange={(e) =>
            onDurationChange(
              phase.id,
              e.target.value === "" ? null : Number(e.target.value)
            )
          }
          onBlur={() => onDurationBlur(phase.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-14 h-8 px-2 text-sm text-center rounded-md border bg-background [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-xs text-muted-foreground">days</span>
      </div>

      {/* Default radio */}
      <button
        onClick={() => !phase.is_default && onSetDefault(phase.id)}
        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          phase.is_default
            ? "border-primary bg-primary"
            : "border-muted-foreground/40 hover:border-primary"
        }`}
        title={phase.is_default ? "Default phase" : "Set as default"}
      >
        {phase.is_default && <Check size={12} className="text-primary-foreground" />}
      </button>

      {/* Archive button */}
      <button
        onClick={() => onArchive(phase.id)}
        disabled={phase.is_default}
        className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
        title={phase.is_default ? "Cannot archive the default phase" : "Archive phase"}
      >
        <Archive size={16} />
      </button>
    </li>
  );
}

/* ── Main component ── */

export function PhaseManager({ initialPhases, isAdmin }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [phases, setPhases] = useState<Phase[]>(
    initialPhases.filter((p) => !p.archived_at)
  );
  const [archivedPhases, setArchivedPhases] = useState<Phase[]>(
    initialPhases.filter((p) => !!p.archived_at)
  );
  const [showArchived, setShowArchived] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  /* ── Name editing ── */

  const handleNameChange = useCallback((id: string, name: string) => {
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, []);

  const handleNameBlur = useCallback(
    async (id: string) => {
      const phase = phases.find((p) => p.id === id);
      if (!phase || !phase.name.trim()) return;
      await supabase
        .from("phases")
        .update({ name: phase.name.trim() })
        .eq("id", id);
    },
    [phases, supabase]
  );

  /* ── Duration editing ── */

  const handleDurationChange = useCallback(
    (id: string, days: number | null) => {
      setPhases((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, default_duration_days: days } : p
        )
      );
    },
    []
  );

  const handleDurationBlur = useCallback(
    async (id: string) => {
      const phase = phases.find((p) => p.id === id);
      if (!phase) return;
      await supabase
        .from("phases")
        .update({ default_duration_days: phase.default_duration_days })
        .eq("id", id);
      // Recalculate all project phase plans that still use defaults
      if (phase.default_duration_days != null) {
        await supabase.rpc("sync_phase_defaults", { p_phase_id: id });
      }
    },
    [phases, supabase]
  );

  /* ── Colour change ── */

  const handleColorChange = useCallback(
    async (id: string, color: string) => {
      setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, color } : p)));
      await supabase.from("phases").update({ color }).eq("id", id);
    },
    [supabase]
  );

  /* ── Set default ── */

  const handleSetDefault = useCallback(
    async (id: string) => {
      setPhases((prev) =>
        prev.map((p) => ({ ...p, is_default: p.id === id }))
      );
      // The DB trigger enforce_single_default_phase handles unsetting the old default
      await supabase.from("phases").update({ is_default: true }).eq("id", id);
    },
    [supabase]
  );

  /* ── Drag reorder ── */

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = phases.findIndex((p) => p.id === active.id);
    const newIndex = phases.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(phases, oldIndex, newIndex).map((p, i) => ({
      ...p,
      sort_order: i,
    }));
    setPhases(reordered);

    // Batch update sort_orders
    await Promise.all(
      reordered.map((p, i) =>
        supabase.from("phases").update({ sort_order: i }).eq("id", p.id)
      )
    );
  }

  /* ── Add phase ── */

  async function handleAddPhase() {
    const maxOrder = phases.reduce((max, p) => Math.max(max, p.sort_order), -1);
    const randomColor =
      PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];

    const { data, error } = await supabase
      .from("phases")
      .insert({
        name: "New phase",
        sort_order: maxOrder + 1,
        color: randomColor,
        is_default: false,
      })
      .select("*")
      .single();

    if (!error && data) {
      setPhases([...phases, data as Phase]);
    }
  }

  /* ── Archive phase ── */

  const handleArchive = useCallback(
    async (id: string) => {
      const phase = phases.find((p) => p.id === id);
      if (!phase || phase.is_default) return;

      // Check usage
      const { count } = await supabase
        .from("rooms")
        .select("id", { count: "exact", head: true })
        .eq("current_phase_id", id);

      if (count && count > 0) {
        const proceed = confirm(
          `${count} room${count !== 1 ? "s are" : " is"} currently in the "${phase.name}" phase. Archiving won't remove them, but this phase won't be available for new assignments. Archive anyway?`
        );
        if (!proceed) return;
      }

      const { error } = await supabase
        .from("phases")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);

      if (!error) {
        const archived = { ...phase, archived_at: new Date().toISOString() };
        setPhases((prev) => prev.filter((p) => p.id !== id));
        setArchivedPhases((prev) => [...prev, archived]);
      }
    },
    [phases, supabase]
  );

  /* ── Restore phase ── */

  async function handleRestore(id: string) {
    const phase = archivedPhases.find((p) => p.id === id);
    if (!phase) return;

    const maxOrder = phases.reduce((max, p) => Math.max(max, p.sort_order), -1);

    const { error } = await supabase
      .from("phases")
      .update({ archived_at: null, sort_order: maxOrder + 1 })
      .eq("id", id);

    if (!error) {
      const restored = { ...phase, archived_at: null, sort_order: maxOrder + 1 };
      setArchivedPhases((prev) => prev.filter((p) => p.id !== id));
      setPhases((prev) => [...prev, restored]);
    }
  }

  /* ── Done editing ── */

  function handleDone() {
    setEditing(false);
    router.refresh(); // Reload server data to sync
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3.5 border-b flex items-center justify-between">
        <h2 className="font-medium">{editing ? "Edit phases" : "Phases"}</h2>
        {isAdmin && (
          <button
            onClick={editing ? handleDone : () => setEditing(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {editing ? "Done" : "Edit phases"}
          </button>
        )}
      </div>

      {editing ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={phases.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="divide-y">
              {phases.map((phase) => (
                <SortablePhaseRow
                  key={phase.id}
                  phase={phase}
                  editing
                  onNameChange={handleNameChange}
                  onNameBlur={handleNameBlur}
                  onColorChange={handleColorChange}
                  onDurationChange={handleDurationChange}
                  onDurationBlur={handleDurationBlur}
                  onSetDefault={handleSetDefault}
                  onArchive={handleArchive}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <ul className="divide-y">
          {phases.map((phase) => (
            <SortablePhaseRow
              key={phase.id}
              phase={phase}
              editing={false}
              onNameChange={() => {}}
              onNameBlur={() => {}}
              onColorChange={() => {}}
              onDurationChange={() => {}}
              onDurationBlur={() => {}}
              onSetDefault={() => {}}
              onArchive={() => {}}
            />
          ))}
        </ul>
      )}

      {/* Add phase button */}
      {editing && (
        <div className="px-5 py-3 border-t">
          <button
            onClick={handleAddPhase}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Plus size={14} />
            Add phase
          </button>
        </div>
      )}

      {/* Archived section */}
      {editing && archivedPhases.length > 0 && (
        <div className="border-t">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="w-full px-5 py-3 flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Archived ({archivedPhases.length})
          </button>
          {showArchived && (
            <ul className="divide-y border-t">
              {archivedPhases.map((phase) => (
                <li
                  key={phase.id}
                  className="px-5 py-3 flex items-center justify-between opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: phase.color }}
                    />
                    <span className="text-sm">{phase.name}</span>
                  </div>
                  <button
                    onClick={() => handleRestore(phase.id)}
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
