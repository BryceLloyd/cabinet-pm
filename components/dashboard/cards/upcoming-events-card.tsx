"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { format, addDays } from "date-fns";
import type { CardProps } from "@/lib/dashboard/card-registry";

interface EventRowRaw {
  id: string;
  title: string;
  event_date: string;
  event_type_id: string | null;
  project_id: string | null;
  projects: { name: string }[] | { name: string } | null;
  event_types: { name: string; color: string }[] | { name: string; color: string } | null;
}

interface EventRow {
  id: string;
  title: string;
  event_date: string;
  event_type_id: string | null;
  project_id: string | null;
  project_name: string | null;
  event_type_name: string | null;
  event_type_color: string;
}

function normalizeEvents(data: EventRowRaw[]): EventRow[] {
  return data.map((ev) => {
    const proj = Array.isArray(ev.projects) ? ev.projects[0] : ev.projects;
    const et = Array.isArray(ev.event_types) ? ev.event_types[0] : ev.event_types;
    return {
      id: ev.id,
      title: ev.title,
      event_date: ev.event_date,
      event_type_id: ev.event_type_id,
      project_id: ev.project_id,
      project_name: proj?.name || null,
      event_type_name: et?.name || null,
      event_type_color: et?.color || "#94a3b8",
    };
  });
}

export default function UpcomingEventsCard({ userId }: CardProps) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const today = format(new Date(), "yyyy-MM-dd");
    const in14 = format(addDays(new Date(), 14), "yyyy-MM-dd");

    supabase
      .from("calendar_events")
      .select("id, title, event_date, event_type_id, project_id, projects(name), event_types(name, color)")
      .gte("event_date", today)
      .lte("event_date", in14)
      .order("event_date")
      .limit(10)
      .then(({ data }) => {
        setEvents(normalizeEvents((data as EventRowRaw[]) || []));
        setLoading(false);
      });
  }, [userId]);

  return (
    <ul className="divide-y">
      {loading && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">Loading...</li>
      )}
      {!loading && events.length === 0 && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">No events in the next 14 days.</li>
      )}
      {events.map((ev) => (
        <li key={ev.id} className="px-5 py-3">
          <Link href="/plan" className="block hover:opacity-70 transition-opacity">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: ev.event_type_color }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{ev.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(ev.event_date), "EEE, MMM d")}
                    {ev.project_name && <> &middot; {ev.project_name}</>}
                  </div>
                </div>
              </div>
              {ev.event_type_name && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                  style={{ backgroundColor: `${ev.event_type_color}20`, color: ev.event_type_color }}
                >
                  {ev.event_type_name}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
