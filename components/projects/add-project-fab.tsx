"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AddProjectPanel } from "@/components/projects/add-project-panel";

export function AddProjectFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex fixed bottom-6 right-6 z-40 items-center gap-2 h-10 pl-4 pr-5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg hover:opacity-90 transition-opacity"
      >
        <Plus size={18} />
        New project
      </button>
      <AddProjectPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
