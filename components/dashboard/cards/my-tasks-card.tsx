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
  task_types: { name: string; color: string } | null;
}

export default function MyTasksCard({ userId, onTaskClick, initialData }: CardProps) {
  const initial = initialData as TaskRow[] | undefined;
  const [tasks, setTasks] = useState<TaskRow[]>(initial ?? []);
  const [loading, setLoading] = useState(initial === undefined);

  useEffect(() => {
    if (initial !== undefined) {
      setTasks(initial);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    supabase
      .from("tasks")
      .select("id, title, due_date, project_id, projects(name), rooms(name), task_types(name, color)")
      .eq("assigned_to", userId)
      .is("completed_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20)
      .then(({ data }) => {
        setTasks((data as unknown as TaskRow[]) || []);
        setLoading(false);
      });
  }, [userId, initial]);

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
              <div className="text-sm font-medium flex items-center gap-2">
                <span className="min-w-0 truncate">{t.title}</span>
                {t.task_types && (
                  <span
                    className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                    style={{ backgroundColor: `${t.task_types.color}20`, color: t.task_types.color }}
                  >
                    {t.task_types.name}
                  </span>
                )}
              </div>
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
