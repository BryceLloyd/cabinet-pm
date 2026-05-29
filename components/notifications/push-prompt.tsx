"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { registerServiceWorker, subscribeToPush } from "@/lib/push/register-sw";

const DISMISSED_KEY = "push-prompt-dismissed";

export function PushPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if not supported
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    // Don't show if already granted or denied
    if (Notification.permission !== "default") return;
    // Don't show if previously dismissed
    if (localStorage.getItem(DISMISSED_KEY)) return;

    setVisible(true);
  }, []);

  async function handleEnable() {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const registration = await registerServiceWorker();
      if (registration) await subscribeToPush(registration);
    }
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  }

  function handleDismiss() {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  }

  if (!visible) return null;

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-3">
      <div className="text-sm">
        <span className="font-medium text-emerald-800">Get notified about tasks and events</span>
        <span className="text-emerald-700"> — Enable push notifications</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleEnable}
          className="h-8 px-3 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
        >
          Enable
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-emerald-600 hover:text-emerald-800 transition-colors"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
