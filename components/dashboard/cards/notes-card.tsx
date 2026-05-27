"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CardProps } from "@/lib/dashboard/card-registry";

const STORAGE_PREFIX = "cabinet-pm-notes-";

export default function NotesCard({ userId }: CardProps) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + userId);
      if (stored) setText(stored);
    } catch {
      // ignore
    }
  }, [userId]);

  const save = useCallback(
    (value: string) => {
      try {
        localStorage.setItem(STORAGE_PREFIX + userId, value);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch {
        // ignore
      }
    },
    [userId]
  );

  function handleChange(value: string) {
    setText(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(value), 500);
  }

  return (
    <div className="px-4 py-3">
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Quick notes..."
        className="w-full min-h-[120px] text-sm bg-transparent border-0 resize-none focus:outline-none placeholder:text-muted-foreground/50"
      />
      {saved && (
        <div className="text-xs text-muted-foreground text-right">Saved</div>
      )}
    </div>
  );
}
