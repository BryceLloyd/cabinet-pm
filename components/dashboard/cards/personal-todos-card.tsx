"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CardProps } from "@/lib/dashboard/card-registry";

interface TodoRow {
  id: string;
  title: string;
  completed_at: string | null;
  task_types: { name: string; color: string } | null;
}

export default function PersonalTodosCard({ userId, onTaskClick, initialData }: CardProps) {
  const initial = initialData as TodoRow[] | undefined;
  const [todos, setTodos] = useState<TodoRow[]>(initial ?? []);
  const [loading, setLoading] = useState(initial === undefined);

  useEffect(() => {
    if (initial !== undefined) {
      setTodos(initial);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    supabase
      .from("tasks")
      .select("id, title, completed_at, task_types(name, color)")
      .eq("assigned_to", userId)
      .is("project_id", null)
      .is("room_id", null)
      .is("completed_at", null)
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => {
        setTodos((data as unknown as TodoRow[]) || []);
        setLoading(false);
      });
  }, [userId, initial]);

  async function toggleComplete(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("tasks")
      .update({ completed_at: new Date().toISOString(), completed_by: userId })
      .eq("id", id);
    if (!error) {
      setTodos((prev) => prev.filter((t) => t.id !== id));
    }
  }

  return (
    <ul className="divide-y">
      {loading && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">Loading...</li>
      )}
      {!loading && todos.length === 0 && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">No personal todos.</li>
      )}
      {todos.map((t) => (
        <li key={t.id} className="px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onTaskClick?.(t.id)}>
          <button
            onClick={(e) => { e.stopPropagation(); toggleComplete(t.id); }}
            className="h-4 w-4 rounded border border-muted-foreground/30 shrink-0 hover:border-foreground transition-colors"
            aria-label={`Complete "${t.title}"`}
          />
          <span className="text-sm truncate flex-1 min-w-0">{t.title}</span>
          {t.task_types && (
            <span
              className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
              style={{ backgroundColor: `${t.task_types.color}20`, color: t.task_types.color }}
            >
              {t.task_types.name}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
