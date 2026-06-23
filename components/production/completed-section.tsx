"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

export function CompletedSection({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-xs text-muted-foreground mb-2 hover:text-foreground">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Completed ({count})
      </button>
      {open && <div className="space-y-1.5">{children}</div>}
    </div>
  );
}
