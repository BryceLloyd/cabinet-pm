import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/send";

export async function POST(request: Request) {
  // Verify webhook secret
  const secret = request.headers.get("x-webhook-secret");
  if (secret !== process.env.SUPABASE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Supabase webhook payload: { type: "INSERT", table: "notifications", record: {...} }
  const notification = body.record;
  if (!notification?.id || !notification?.user_id) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Already sent?
  if (notification.push_sent_at) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const admin = createAdminClient();

  // Get user's push subscriptions
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", notification.user_id);

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Send push
  const result = await sendPushToUser(subscriptions, notification);

  // Mark notification as push-sent
  await admin
    .from("notifications")
    .update({ push_sent_at: new Date().toISOString() })
    .eq("id", notification.id);

  // Clean up expired subscriptions
  if (result.expired.length > 0) {
    await admin
      .from("push_subscriptions")
      .delete()
      .in("id", result.expired);
  }

  return NextResponse.json({ ok: true, sent: result.sent, expired: result.expired.length });
}
