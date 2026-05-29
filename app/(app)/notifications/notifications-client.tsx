"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NotificationItem } from "@/components/notifications/notification-item";
import type { Notification } from "@/lib/types/notifications";

interface Props {
  initialNotifications: Notification[];
  userId: string;
}

export function NotificationsPageClient({ initialNotifications, userId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState(initialNotifications);

  const filtered = filter === "unread"
    ? notifications.filter((n) => !n.read_at)
    : notifications;

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function handleMarkRead(notificationId: string) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n))
    );
  }

  async function handleMarkAllRead() {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);

    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
  }

  function handleNavigate(url: string) {
    router.push(url);
  }

  return (
    <div>
      {/* Filter tabs + mark all */}
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex items-center rounded-md border p-0.5">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`h-7 px-3 text-xs rounded font-medium transition-colors capitalize ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {f}{f === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs text-emerald-600 hover:text-emerald-700"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="rounded-lg border overflow-hidden divide-y">
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {filter === "unread" ? "No unread notifications" : "No notifications yet"}
          </div>
        ) : (
          filtered.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onRead={handleMarkRead}
              onNavigate={handleNavigate}
            />
          ))
        )}
      </div>
    </div>
  );
}
