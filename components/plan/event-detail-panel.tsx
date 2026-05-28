"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { SlidePanel } from "@/components/ui/slide-panel";
import type { CalendarEvent, EventType, Project, RoomGroup } from "@/lib/types";

interface EventDetailPanelProps {
  event: CalendarEvent | null;
  eventTypes: EventType[];
  projects: Project[];
  roomGroups: RoomGroup[];
  groupsByProject: Map<string, RoomGroup[]>;
  onClose: () => void;
  onUpdated: (event: CalendarEvent) => void;
  onDeleted: (id: string) => void;
}

export function EventDetailPanel({
  event, eventTypes, projects, roomGroups, groupsByProject,
  onClose, onUpdated, onDeleted,
}: EventDetailPanelProps) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [typeId, setTypeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [notes, setNotes] = useState("");
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when event changes
  useEffect(() => {
    if (!event) return;
    setTitle(event.title);
    setEventDate(event.event_date);
    setTypeId(event.event_type_id || "");
    setProjectId(event.project_id || "");
    setGroupId(event.room_group_id || "");
    setNotes(event.notes || "");
    setCreatorName(null);
    supabase.from("profiles").select("full_name").eq("id", event.created_by).single()
      .then(({ data }) => { if (data) setCreatorName(data.full_name); });
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const availableGroups = projectId ? (groupsByProject.get(projectId) || []) : [];

  // Get event type color for the dot
  const activeType = typeId ? eventTypes.find((t) => t.id === typeId) : null;
  const dotColor = activeType?.color || "#94a3b8";

  // Auto-save with 800ms debounce
  const autoSave = useCallback(
    (updates: Record<string, string | null>) => {
      if (!event) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        const { data, error } = await supabase
          .from("calendar_events")
          .update(updates)
          .eq("id", event.id)
          .select("*")
          .single();
        if (!error && data) {
          onUpdated(data as CalendarEvent);
        }
      }, 800);
    },
    [event, supabase, onUpdated],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  async function handleDelete() {
    if (!event) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", event.id);
    if (!error) {
      onDeleted(event.id);
      onClose();
    }
  }

  if (!event) return null;

  return (
    <SlidePanel
      open={!!event}
      onClose={onClose}
      title="Event Detail"
      onDelete={handleDelete}
    >
      {/* Color dot + Title */}
      <div className="flex items-start gap-3 mb-5">
        <div
          className="w-3 h-3 rounded-full mt-1.5 shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            autoSave({ title: e.target.value });
          }}
          className="flex-1 text-[15px] font-medium bg-transparent border border-transparent hover:border-border focus:border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Date */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Date
        </label>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => {
            setEventDate(e.target.value);
            autoSave({ event_date: e.target.value });
          }}
          className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Event type */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Event type
        </label>
        <select
          value={typeId}
          onChange={(e) => {
            setTypeId(e.target.value);
            autoSave({ event_type_id: e.target.value || null });
          }}
          className="w-full h-9 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">None</option>
          {eventTypes.filter((t) => !t.archived_at).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Project */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Project
        </label>
        <select
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setGroupId("");
            autoSave({ project_id: e.target.value || null, room_group_id: null });
          }}
          className="w-full h-9 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">None</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Room group (conditional) */}
      {projectId && availableGroups.length > 0 && (
        <div className="mb-4">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Room group
          </label>
          <select
            value={groupId}
            onChange={(e) => {
              setGroupId(e.target.value);
              autoSave({ room_group_id: e.target.value || null });
            }}
            className="w-full h-9 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">None</option>
            {availableGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            autoSave({ notes: e.target.value || null });
          }}
          placeholder="Add notes..."
          rows={4}
          className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {/* Meta footer */}
      <div className="pt-3 border-t text-[11px] text-muted-foreground">
        Created {format(new Date(event.created_at), "MMM d, yyyy")}{creatorName ? ` by ${creatorName}` : ""}
      </div>
    </SlidePanel>
  );
}
