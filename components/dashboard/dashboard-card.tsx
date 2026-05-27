"use client";

import Link from "next/link";
import { X } from "lucide-react";

interface Props {
  title: string;
  actionLabel?: string;
  actionHref?: string;
  isEditing?: boolean;
  onRemove?: () => void;
  children: React.ReactNode;
}

export function DashboardCard({ title, actionLabel, actionHref, isEditing, onRemove, children }: Props) {
  return (
    <section className="rounded-lg border bg-card relative">
      {isEditing && onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-2 -right-2 z-10 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:opacity-80"
          aria-label="Remove card"
        >
          <X size={14} />
        </button>
      )}
      <div className="border-b flex items-center justify-between" style={{ padding: "var(--density-row-padding) var(--density-card-padding)" }}>
        <h2 className="font-medium text-sm">{title}</h2>
        {actionLabel && actionHref && (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <Link href={actionHref as any} className="text-xs text-muted-foreground hover:text-foreground">
            {actionLabel} &rarr;
          </Link>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}
