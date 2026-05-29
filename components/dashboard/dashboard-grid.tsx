"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { GripVertical, Plus, Pencil, FolderKanban, CheckSquare, CalendarPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CARD_REGISTRY, type CardProps } from "@/lib/dashboard/card-registry";
import { getLayout, setLayout, type CardLayout } from "@/lib/dashboard/dashboard-layout";
import { DashboardCard } from "./dashboard-card";
import { CardSkeleton } from "./card-skeleton";
import { AddCardDialog } from "./add-card-dialog";
import { AddTaskPanel } from "@/components/tasks/add-task-panel";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { AddEventPanel } from "@/components/plan/add-event-panel";
import { EventDetailPanel } from "@/components/plan/event-detail-panel";
import { AddProjectPanel } from "@/components/projects/add-project-panel";
import type { CalendarEvent, EventType, Project, RoomGroup } from "@/lib/types";

function SortableCard({
  cardLayout,
  userId,
  isEditing,
  onRemove,
  onTaskClick,
  onEventClick,
}: {
  cardLayout: CardLayout;
  userId: string;
  isEditing: boolean;
  onRemove: () => void;
  onTaskClick?: (taskId: string) => void;
  onEventClick?: (eventId: string) => void;
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
              <LazyComponent userId={userId} onTaskClick={onTaskClick} onEventClick={onEventClick} />
            </DashboardCard>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export function DashboardGrid({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [cards, setCards] = useState<CardLayout[]>(() => getLayout(userId));
  const [isEditing, setIsEditing] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Quick-add menu + slide panel state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const quickAddRef = useRef<HTMLDivElement>(null);

  // Data for slide panels (loaded once on mount)
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>([]);
  const [eventTypes, setEventTypes] = useState<{ id: string; name: string; color: string; archived_at: string | null }[]>([]);
  const [taskTypes, setTaskTypes] = useState<{ id: string; name: string; color: string }[]>([]);
  const [roomGroups, setRoomGroups] = useState<{ id: string; name: string; project_id: string }[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Detail panel state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const groupsByProject = useRef(new Map<string, { id: string; name: string; project_id: string }[]>());

  // Load panel data once
  useEffect(() => {
    if (dataLoaded) return;
    Promise.all([
      supabase.from("projects").select("id, name").in("status", ["planning", "active"]).order("name"),
      supabase.from("profiles").select("id, full_name").is("deactivated_at", null).order("full_name"),
      supabase.from("event_types").select("id, name, color, archived_at").order("sort_order"),
      supabase.from("task_types").select("id, name, color").is("archived_at", null).order("sort_order"),
      supabase.from("room_groups").select("id, name, project_id").order("sort_order"),
    ]).then(([{ data: p }, { data: pr }, { data: et }, { data: tt }, { data: rg }]) => {
      setProjects(p || []);
      setProfiles(pr || []);
      setEventTypes(et || []);
      setTaskTypes(tt || []);
      const groups = rg || [];
      setRoomGroups(groups);
      const map = new Map<string, typeof groups>();
      groups.forEach((g) => {
        const list = map.get(g.project_id) || [];
        list.push(g);
        map.set(g.project_id, list);
      });
      groupsByProject.current = map;
      setDataLoaded(true);
    });
  }, [dataLoaded, supabase]);

  // Fetch and open task detail panel
  const handleTaskClick = useCallback(async (taskId: string) => {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, description, due_date, priority, project_id, room_id, room_group_id, task_type_id, assigned_to, completed_at, completed_by, created_by, created_at, projects(name), rooms(name), room_groups(name), task_types(id,name,color), assignee:profiles!tasks_assigned_to_fkey(full_name), completer:profiles!tasks_completed_by_fkey(full_name)")
      .eq("id", taskId)
      .single();
    if (data) {
      const row = data as Record<string, unknown>;
      if (Array.isArray(row.projects)) row.projects = row.projects[0] || null;
      if (Array.isArray(row.rooms)) row.rooms = row.rooms[0] || null;
      if (Array.isArray(row.room_groups)) row.room_groups = row.room_groups[0] || null;
      if (Array.isArray(row.task_types)) row.task_types = row.task_types[0] || null;
      if (Array.isArray(row.assignee)) row.assignee = row.assignee[0] || null;
      if (Array.isArray(row.completer)) row.completer = row.completer[0] || null;
      setSelectedTask(row);
    }
  }, [supabase]);

  // Fetch and open event detail panel
  const handleEventClick = useCallback(async (eventId: string) => {
    const { data } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("id", eventId)
      .single();
    if (data) setSelectedEvent(data as CalendarEvent);
  }, [supabase]);

  // Close quick-add menu on outside click
  useEffect(() => {
    if (!showQuickAdd) return;
    function handleClick(e: MouseEvent) {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
        setShowQuickAdd(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showQuickAdd]);

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
                onTaskClick={handleTaskClick}
                onEventClick={handleEventClick}
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

      {/* Floating pill + quick-add menu – desktop only */}
      <div ref={quickAddRef} className="hidden md:block fixed bottom-6 right-6 z-40">
        {showQuickAdd && (
          <div className="absolute bottom-full right-0 mb-2 w-56 rounded-lg border bg-card shadow-lg py-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <button
              onClick={() => { setShowQuickAdd(false); setShowAddProject(true); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
            >
              <FolderKanban size={16} className="text-muted-foreground shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium">New project</div>
                <div className="text-[11px] text-muted-foreground">Create a new project</div>
              </div>
            </button>
            <button
              onClick={() => { setShowQuickAdd(false); setShowAddTask(true); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
            >
              <CheckSquare size={16} className="text-muted-foreground shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium">New task</div>
                <div className="text-[11px] text-muted-foreground">Add a task or personal todo</div>
              </div>
            </button>
            <button
              onClick={() => { setShowQuickAdd(false); setShowAddEvent(true); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
            >
              <CalendarPlus size={16} className="text-muted-foreground shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium">Add event</div>
                <div className="text-[11px] text-muted-foreground">Add a calendar event</div>
              </div>
            </button>
          </div>
        )}
        <button
          onClick={() => setShowQuickAdd(!showQuickAdd)}
          className="inline-flex items-center gap-2 h-10 pl-4 pr-5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg hover:opacity-90 transition-opacity"
        >
          <Plus size={18} />
          Add
        </button>
      </div>

      {/* Add project slide panel */}
      <AddProjectPanel
        open={showAddProject}
        onClose={() => setShowAddProject(false)}
      />

      {/* Add task slide panel */}
      <AddTaskPanel
        open={showAddTask}
        projects={projects}
        profiles={profiles}
        taskTypes={taskTypes}
        userId={userId}
        onClose={() => setShowAddTask(false)}
        onCreated={() => { setShowAddTask(false); router.refresh(); }}
      />

      {/* Add event slide panel */}
      <AddEventPanel
        open={showAddEvent}
        projects={projects}
        eventTypes={eventTypes}
        roomGroups={roomGroups}
        groupsByProject={groupsByProject.current}
        onClose={() => setShowAddEvent(false)}
        onCreated={() => { setShowAddEvent(false); router.refresh(); }}
      />

      {/* Task detail panel */}
      <TaskDetailPanel
        task={selectedTask}
        profiles={profiles}
        taskTypes={taskTypes}
        userId={userId}
        onClose={() => setSelectedTask(null)}
        onUpdated={(updated) => { setSelectedTask(updated); router.refresh(); }}
        onDeleted={() => { setSelectedTask(null); router.refresh(); }}
        onToggleComplete={() => { setSelectedTask(null); router.refresh(); }}
      />

      {/* Event detail panel */}
      <EventDetailPanel
        event={selectedEvent}
        eventTypes={eventTypes as EventType[]}
        projects={projects as Project[]}
        roomGroups={roomGroups as RoomGroup[]}
        groupsByProject={groupsByProject.current as Map<string, RoomGroup[]>}
        onClose={() => setSelectedEvent(null)}
        onUpdated={(updated) => { setSelectedEvent(updated); router.refresh(); }}
        onDeleted={() => { setSelectedEvent(null); router.refresh(); }}
      />
    </div>
  );
}
