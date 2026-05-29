"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/register-sw";
import type { NotificationPreferences } from "@/lib/types/notifications";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/types/notifications";

interface Props {
  userId: string;
  initialPreferences: NotificationPreferences;
}

const NOTIFICATION_GROUPS = [
  {
    label: "Tasks",
    items: [
      { key: "task_assigned" as const, label: "Task assigned", description: "When someone assigns a task to you" },
      { key: "task_due_today" as const, label: "Task due today", description: "Morning reminder for tasks due today" },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { key: "phase_changed" as const, label: "Phase changes", description: "When a room moves to a new phase" },
    ],
  },
  {
    label: "Calendar",
    items: [
      { key: "event_reminder" as const, label: "Event reminders", description: "Day-before and morning-of reminders" },
    ],
  },
];

export function NotificationPreferencesForm({ userId, initialPreferences }: Props) {
  const supabase = createClient();
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...initialPreferences,
  });
  const [pushStatus, setPushStatus] = useState<"loading" | "granted" | "denied" | "default">("loading");
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Check push permission status
  useEffect(() => {
    if (!("Notification" in window)) {
      setPushStatus("denied");
      return;
    }
    setPushStatus(Notification.permission as "granted" | "denied" | "default");
  }, []);

  const savePrefs = useCallback(
    (newPrefs: NotificationPreferences) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        await supabase
          .from("profiles")
          .update({ notification_preferences: newPrefs })
          .eq("id", userId);
      }, 800);
    },
    [supabase, userId]
  );

  function handleToggle(key: keyof NotificationPreferences) {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    savePrefs(newPrefs);
  }

  async function handleEnablePush() {
    const permission = await Notification.requestPermission();
    setPushStatus(permission as "granted" | "denied" | "default");
    if (permission === "granted") {
      const registration = await registerServiceWorker();
      if (registration) await subscribeToPush(registration);
    }
  }

  async function handleDisablePush() {
    await unsubscribeFromPush();
    setPushStatus("default");
  }

  return (
    <div className="space-y-6">
      {/* Push permission banner */}
      <div className={`rounded-lg border px-4 py-3 flex items-center justify-between ${
        pushStatus === "granted"
          ? "bg-emerald-50 border-emerald-200"
          : pushStatus === "denied"
          ? "bg-red-50 border-red-200"
          : "bg-muted border-border"
      }`}>
        <div>
          <div className={`text-sm font-medium ${
            pushStatus === "granted" ? "text-emerald-800" : pushStatus === "denied" ? "text-red-800" : ""
          }`}>
            Push notifications
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {pushStatus === "granted" && "Get alerts even when the app isn't open"}
            {pushStatus === "denied" && "Push blocked — enable in browser settings"}
            {pushStatus === "default" && "Get alerts even when the app isn't open"}
            {pushStatus === "loading" && "Checking..."}
          </div>
        </div>
        {pushStatus === "granted" && (
          <button
            type="button"
            onClick={handleDisablePush}
            className="h-8 px-3 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Enabled ✓
          </button>
        )}
        {pushStatus === "default" && (
          <button
            type="button"
            onClick={handleEnablePush}
            className="h-8 px-3 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90"
          >
            Enable
          </button>
        )}
      </div>

      {/* Grouped toggles */}
      {NOTIFICATION_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {group.label}
          </div>
          <div className="rounded-lg border bg-card divide-y">
            {group.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs[item.key]}
                  onClick={() => handleToggle(item.key)}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                    prefs[item.key] ? "bg-emerald-500" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${
                      prefs[item.key] ? "translate-x-[22px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
