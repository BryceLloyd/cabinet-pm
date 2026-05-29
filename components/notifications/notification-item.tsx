"use client";

import { formatDistanceToNow } from "date-fns";
import type { Notification } from "@/lib/types/notifications";

const TYPE_COLORS: Record<string, string> = {
  task_assigned: "border-l-emerald-500",
  task_due_today: "border-l-amber-500",
  phase_changed: "border-l-blue-500",
  event_reminder: "border-l-amber-500",
};

const UNREAD_BG: Record<string, string> = {
  task_assigned: "bg-emerald-50 dark:bg-emerald-950/20",
  task_due_today: "bg-amber-50 dark:bg-amber-950/20",
  phase_changed: "bg-blue-50 dark:bg-blue-950/20",
  event_reminder: "bg-amber-50 dark:bg-amber-950/20",
};

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onNavigate: (url: string) => void;
}

export function NotificationItem({ notification, onRead, onNavigate }: NotificationItemProps) {
  const isUnread = !notification.read_at;

  function handleClick() {
    if (isUnread) onRead(notification.id);
    if (notification.url) onNavigate(notification.url);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full text-left px-4 py-3 border-l-3 transition-colors hover:bg-muted/50 ${
        TYPE_COLORS[notification.type] || "border-l-transparent"
      } ${isUnread ? UNREAD_BG[notification.type] || "" : "opacity-60"}`}
    >
      <div className="text-sm font-medium leading-tight">{notification.title}</div>
      {notification.body && (
        <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{notification.body}</div>
      )}
      <div className="text-[11px] text-muted-foreground/70 mt-1">
        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
      </div>
    </button>
  );
}
