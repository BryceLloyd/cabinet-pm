"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CardProps } from "@/lib/dashboard/card-registry";

interface TodoRow {
  id: string;
  title: string;
  completed_at: string | null;
}

export default function PersonalTodosCard({ userId }: CardProps) {
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("tasks")
      .select("id, title, completed_at")
      .eq("assigned_to", userId)
      .is("project_id", null)
      .is("room_id", null)
      .is("completed_at", null)
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => {
        setTodos((data as TodoRow[]) || []);
        setLoading(false);
      });
  }, [userId]);

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
        <li key={t.id} className="px-5 py-3 flex items-center gap-3">
          <button
            onClick={() => toggleComplete(t.id)}
            className="h-4 w-4 rounded border border-muted-foreground/30 shrink-0 hover:border-foreground transition-colors"
            aria-label={`Complete "${t.title}"`}
          />
          <span className="text-sm truncate">{t.title}</span>
        </li>
      ))}
    </ul>
  );
}
