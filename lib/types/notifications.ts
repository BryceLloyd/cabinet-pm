export type NotificationType =
  | "task_assigned"
  | "task_due_today"
  | "phase_changed"
  | "event_reminder";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  url: string | null;
  metadata: Record<string, string | null> | null;
  read_at: string | null;
  push_sent_at: string | null;
  created_at: string;
}

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  task_assigned: boolean;
  task_due_today: boolean;
  phase_changed: boolean;
  event_reminder: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  task_assigned: true,
  task_due_today: true,
  phase_changed: true,
  event_reminder: true,
};
