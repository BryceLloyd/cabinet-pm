"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, isPast, isToday } from "date-fns";
import type { CardProps } from "@/lib/dashboard/card-registry";

interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  project_id: string | null;
  projects: { name: string } | null;
  rooms: { name: string } | null;
}

export default function MyTasksCard({ userId, onTaskClick }: CardProps) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("tasks")
      .select("id, title, due_date, project_id, projects(name), rooms(name)")
      .eq("assigned_to", userId)
      .is("completed_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20)
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setTasks((data as unknown as TaskRow[]) || []);
        setLoading(false);
      });
  }, [userId]);

  return (
    <ul className="divide-y">
      {loading && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">Loading...</li>
      )}
      {!loading && tasks.length === 0 && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">No open tasks. Nice.</li>
      )}
      {tasks.map((t) => {
        const overdue = t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
        return (
          <li key={t.id} className="px-5 py-3 flex items-start gap-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onTaskClick?.(t.id)}>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{t.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t.projects?.name && <span>{t.projects.name}</span>}
                {t.rooms?.name && <span> · {t.rooms.name}</span>}
                {!t.projects && !t.rooms && <span>Personal</span>}
              </div>
            </div>
            {t.due_date && (
              <div className={`text-xs shrink-0 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                {format(new Date(t.due_date), "MMM d")}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
