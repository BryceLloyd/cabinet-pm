"use client";

import { Suspense, useCallback, useState } from "react";
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Pencil } from "lucide-react";
import { CARD_REGISTRY, type CardProps } from "@/lib/dashboard/card-registry";
import { getLayout, setLayout, type CardLayout } from "@/lib/dashboard/dashboard-layout";
import { DashboardCard } from "./dashboard-card";
import { CardSkeleton } from "./card-skeleton";
import { AddCardDialog } from "./add-card-dialog";

function SortableCard({
  cardLayout,
  userId,
  isEditing,
  onRemove,
}: {
  cardLayout: CardLayout;
  userId: string;
  isEditing: boolean;
  onRemove: () => void;
}) {
  const definition = CARD_REGISTRY[cardLayout.cardType];
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cardLayout.cardType, disabled: !isEditing });

  if (!definition) return null;

  const LazyComponent = definition.component;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={definition.defaultSize === "lg" ? "lg:col-span-2" : ""}
    >
      <div className="relative">
        {isEditing && (
          <button
            {...attributes}
            {...listeners}
            className="absolute top-3 left-1.5 z-10 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
            aria-label="Drag to reorder"
          >
            <GripVertical size={16} />
          </button>
        )}
        <div className={isEditing ? "pl-6" : ""}>
          <Suspense fallback={<CardSkeleton />}>
            <DashboardCard
              title={definition.title}
              actionLabel={definition.actionLabel}
              actionHref={definition.actionHref}
              isEditing={isEditing}
              onRemove={onRemove}
            >
              <LazyComponent userId={userId} />
            </DashboardCard>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export function DashboardGrid({ userId }: { userId: string }) {
  const [cards, setCards] = useState<CardLayout[]>(() => getLayout(userId));
  const [isEditing, setIsEditing] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeCardTypes = cards.map((c) => c.cardType);

  const persist = useCallback(
    (next: CardLayout[]) => {
      setCards(next);
      setLayout(userId, next);
    },
    [userId]
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = cards.findIndex((c) => c.cardType === active.id);
    const newIndex = cards.findIndex((c) => c.cardType === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    persist(arrayMove(cards, oldIndex, newIndex));
  }

  function removeCard(cardType: string) {
    persist(cards.filter((c) => c.cardType !== cardType));
  }

  function addCard(cardType: string) {
    persist([...cards, { cardType, position: cards.length }]);
    setShowAddDialog(false);
  }

  return (
    <div className="container py-6 md:py-8 px-4">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="h-8 px-3 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 border hover:bg-muted"
        >
          <Pencil size={14} />
          {isEditing ? "Done" : "Customise"}
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeCardTypes} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: "var(--density-gap)" }}>
            {cards.map((card) => (
              <SortableCard
                key={card.cardType}
                cardLayout={card}
                userId={userId}
                isEditing={isEditing}
                onRemove={() => removeCard(card.cardType)}
              />
            ))}

            {isEditing && (
              <button
                onClick={() => setShowAddDialog(true)}
                className="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-transparent flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <Plus size={24} />
                <span className="text-sm font-medium">Add card</span>
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <AddCardDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        activeCardTypes={activeCardTypes}
        onAdd={addCard}
      />
    </div>
  );
}
