"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CardProps } from "@/lib/dashboard/card-registry";

interface MemberLoad {
  id: string;
  name: string;
  count: number;
}

export default function TeamWorkloadCard({ userId }: CardProps) {
  const [members, setMembers] = useState<MemberLoad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from("tasks")
        .select("assigned_to")
        .is("completed_at", null)
        .not("assigned_to", "is", null),
      supabase.from("profiles").select("id, full_name"),
    ]).then(([{ data: tasks }, { data: profiles }]) => {
      const counts = new Map<string, number>();
      (tasks || []).forEach((t) => {
        if (t.assigned_to) {
          counts.set(t.assigned_to, (counts.get(t.assigned_to) || 0) + 1);
        }
      });
      const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name || "Unknown"]));
      const result: MemberLoad[] = [];
      counts.forEach((count, id) => {
        result.push({ id, name: profileMap.get(id) || "Unknown", count });
      });
      result.sort((a, b) => b.count - a.count);
      setMembers(result);
      setLoading(false);
    });
  }, [userId]);

  return (
    <ul className="divide-y">
      {loading && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">Loading...</li>
      )}
      {!loading && members.length === 0 && (
        <li className="px-5 py-8 text-sm text-muted-foreground text-center">No assigned tasks.</li>
      )}
      {members.map((m) => (
        <li key={m.id} className="px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-medium truncate">{m.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{m.count} tasks</span>
        </li>
      ))}
    </ul>
  );
}
