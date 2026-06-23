"use client";

import { Plus } from "lucide-react";

/** Floating add-action pill — bottom-right on desktop (matching the office pages), centred above the tab bar on mobile. */
export function ActionPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <>
      <button
        onClick={onClick}
        className="md:hidden fixed bottom-[calc(72px+env(safe-area-inset-bottom)+12px)] left-1/2 -translate-x-1/2 z-40 h-11 px-5 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center gap-1.5 text-sm font-medium active:scale-95 transition-transform"
      >
        <Plus size={18} strokeWidth={2.5} />
        {label}
      </button>
      <button
        onClick={onClick}
        className="hidden md:inline-flex fixed bottom-6 right-6 z-40 items-center gap-2 h-10 pl-4 pr-5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg hover:opacity-90 transition-opacity"
      >
        <Plus size={16} />
        {label}
      </button>
    </>
  );
}
