"use client";

import { useEffect, useMemo, useState } from "react";
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
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface HasId { id: string }

function SortableRow({ id, render }: { id: string; render: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  const handle = (
    <button {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0" aria-label="Drag to reorder">
      <GripVertical size={14} />
    </button>
  );
  return <div ref={setNodeRef} style={style}>{render(handle)}</div>;
}

interface Props<T extends HasId> {
  items: T[];
  /** Supabase table whose rows carry a `sort_order` column. */
  table: string;
  /** Stable id for the DndContext — required so SSR/client a11y ids match across multiple lists. */
  id: string;
  renderItem: (item: T, handle: React.ReactNode) => React.ReactNode;
}

/** Vertical drag-to-reorder list. Persists the new order to `table.sort_order`. */
export function DraggableList<T extends HasId>({ items, table, id, renderItem }: Props<T>) {
  const router = useRouter();
  const supabase = createClient();
  const sig = useMemo(() => items.map((i) => i.id).join("|"), [items]);
  const [order, setOrder] = useState<T[]>(items);
  useEffect(() => setOrder(items), [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = order.findIndex((i) => i.id === active.id);
    const newI = order.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(order, oldI, newI);
    setOrder(reordered);
    await Promise.all(reordered.map((it, i) => supabase.from(table).update({ sort_order: i }).eq("id", it.id)));
    router.refresh();
  }

  return (
    <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {order.map((it) => <SortableRow key={it.id} id={it.id} render={(handle) => renderItem(it, handle)} />)}
      </SortableContext>
    </DndContext>
  );
}
