"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import type { CalendarEvent, EventType, Project, RoomGroup } from "@/lib/types";
import { EventDetailPanel } from "@/components/plan/event-detail-panel";

interface EventsListViewProps {
  year: number;
  events: CalendarEvent[];
  eventTypes: EventType[];
  eventTypeMap: Map<string, EventType>;
  projects: Project[];
  roomGroups: RoomGroup[];
  groupsByProject: Map<string, RoomGroup[]>;
  onEventUpdated: (event: CalendarEvent) => void;
  onEventDeleted: (id: string) => void;
}

interface MonthGroup {
  key: string;
  label: string;
  events: CalendarEvent[];
}

export function EventsListView({
  year, events, eventTypes, eventTypeMap, projects, roomGroups, groupsByProject,
  onEventUpdated, onEventDeleted,
}: EventsListViewProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const currentMonthRef = useRef<HTMLDivElement>(null);

  // Group events by month
  const monthGroups = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const date = parseISO(ev.event_date);
      const key = format(date, "yyyy-MM");
      const arr = groups.get(key) || [];
      arr.push(ev);
      groups.set(key, arr);
    }

    const result: MonthGroup[] = [];
    groups.forEach((evts, key) => {
      const date = parseISO(key + "-01");
      result.push({
        key,
        label: format(date, "MMMM yyyy"),
        events: evts.sort((a, b) => a.event_date.localeCompare(b.event_date)),
      });
    });
    result.sort((a, b) => a.key.localeCompare(b.key));
    return result;
  }, [events]);

  // Determine current month key for auto-scroll
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    if (now.getFullYear() !== year) return null;
    return format(now, "yyyy-MM");
  }, [year]);

  // Auto-scroll to current month on mount
  useEffect(() => {
    if (!currentMonthRef.current) return;
    const timer = setTimeout(() => {
      if (!currentMonthRef.current) return;
      const rect = currentMonthRef.current.getBoundingClientRect();
      const scrollTop = window.scrollY + rect.top - 80;
      window.scrollTo({ top: Math.max(0, scrollTop), behavior: "instant" });
    }, 100);
    return () => clearTimeout(timer);
  }, [year]);

  // Build project lookup for display
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const roomGroupMap = useMemo(() => new Map(roomGroups.map((g) => [g.id, g])), [roomGroups]);

  if (monthGroups.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">No events for {year}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {monthGroups.map((group) => (
        <div
          key={group.key}
          ref={group.key === currentMonthKey ? currentMonthRef : undefined}
        >
          {/* Month header */}
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 pb-1.5 border-b">
            {group.label}
          </div>

          {/* Event cards */}
          <div className="space-y-1.5">
            {group.events.map((ev) => {
              const et = ev.event_type_id ? eventTypeMap.get(ev.event_type_id) : null;
              const color = et?.color || "#94a3b8";
              const project = ev.project_id ? projectMap.get(ev.project_id) : null;
              const roomGroup = ev.room_group_id ? roomGroupMap.get(ev.room_group_id) : null;
              const date = parseISO(ev.event_date);

              return (
                <div
                  key={ev.id}
                  className="flex items-start gap-2 px-3 py-2 border rounded-lg bg-card cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedEvent(ev)}
                >
                  {/* Color dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: color }}
                  />

                  {/* Title + project */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{ev.title}</div>
                    {project && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {project.name}
                        {roomGroup && ` · ${roomGroup.name}`}
                      </div>
                    )}
                  </div>

                  {/* Date + type badge */}
                  <div className="text-right shrink-0">
                    <div className="text-[13px] font-medium">
                      {format(date, "EEE d")}
                    </div>
                    {et && (
                      <span
                        className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{
                          backgroundColor: `${color}20`,
                          color,
                        }}
                      >
                        {et.name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Event detail panel */}
      <EventDetailPanel
        event={selectedEvent}
        eventTypes={eventTypes}
        projects={projects}
        roomGroups={roomGroups}
        groupsByProject={groupsByProject}
        onClose={() => setSelectedEvent(null)}
        onUpdated={(updated) => {
          onEventUpdated(updated);
          setSelectedEvent(updated);
        }}
        onDeleted={(id) => {
          onEventDeleted(id);
          setSelectedEvent(null);
        }}
      />
    </div>
  );
}
