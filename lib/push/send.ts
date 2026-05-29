import webpush from "web-push";
import type { Notification } from "@/lib/types/notifications";

// Configure web-push with VAPID keys
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = "mailto:bryceblloyd@gmail.com";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn("VAPID keys not set — push notifications disabled");
    return;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
}

interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface SendResult {
  sent: number;
  expired: string[]; // subscription IDs that returned 410
}

/**
 * Send a push notification to all of a user's subscriptions.
 * Returns the count sent and any expired subscription IDs to clean up.
 */
export async function sendPushToUser(
  subscriptions: PushSubscription[],
  notification: Pick<Notification, "id" | "title" | "body" | "url" | "type">
): Promise<SendResult> {
  ensureConfigured();

  if (!configured || subscriptions.length === 0) {
    return { sent: 0, expired: [] };
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body || "",
    url: notification.url || "/dashboard",
    type: notification.type,
    notificationId: notification.id,
  });

  const expired: string[] = [];
  let sent = 0;

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          // Subscription expired or invalid — mark for cleanup
          expired.push(sub.id);
        } else {
          console.error(`Push failed for subscription ${sub.id}:`, err);
        }
      }
    })
  );

  return { sent, expired };
}
