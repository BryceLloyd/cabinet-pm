import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/send";

export async function GET(request: Request) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const utcHour = now.getUTCHours();

  // Today's date in SAST (UTC+2) for date comparisons
  const sastNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const todayISO = sastNow.toISOString().split("T")[0];

  // Tomorrow
  const tomorrow = new Date(sastNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().split("T")[0];

  let totalCreated = 0;

  // --- Morning run (UTC hour 5 = 7 AM SAST): task_due_today + event reminders for today ---
  if (utcHour === 5) {
    totalCreated += await processTasksDueToday(admin, todayISO);
    totalCreated += await processEventReminders(admin, todayISO, "today");
  }

  // --- Afternoon run (UTC hour 14 = 4 PM SAST): event reminders for tomorrow ---
  if (utcHour === 14) {
    totalCreated += await processEventReminders(admin, tomorrowISO, "tomorrow");
  }

  return NextResponse.json({ ok: true, created: totalCreated, utcHour });
}

async function processTasksDueToday(
  admin: ReturnType<typeof createAdminClient>,
  todayISO: string
): Promise<number> {
  // Find incomplete tasks due today
  const { data: tasks } = await admin
    .from("tasks")
    .select("id, title, assigned_to, project_id, projects(name)")
    .eq("due_date", todayISO)
    .is("completed_at", null)
    .not("assigned_to", "is", null);

  if (!tasks || tasks.length === 0) return 0;

  let count = 0;

  for (const task of tasks) {
    const assignee = task.assigned_to as string;

    // Check preferences
    const { data: profile } = await admin
      .from("profiles")
      .select("notification_preferences")
      .eq("id", assignee)
      .single();

    const prefs = profile?.notification_preferences as Record<string, unknown> | null;
    if (prefs?.task_due_today === false) continue;

    // Deduplicate: check if we already sent this today
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", assignee)
      .eq("type", "task_due_today")
      .gte("created_at", todayISO)
      .contains("metadata", { task_id: task.id })
      .limit(1);

    if (existing && existing.length > 0) continue;

    const projectName = Array.isArray(task.projects)
      ? task.projects[0]?.name
      : (task.projects as { name: string } | null)?.name;

    // Insert notification
    const { data: notification } = await admin
      .from("notifications")
      .insert({
        user_id: assignee,
        type: "task_due_today",
        title: "Task due today",
        body: task.title + (projectName ? ` — ${projectName}` : ""),
        url: `/tasks?highlight=${task.id}`,
        metadata: { task_id: task.id, project_id: task.project_id },
      })
      .select("id, title, body, url, type")
      .single();

    if (notification) {
      await sendPushForNotification(admin, assignee, notification);
      count++;
    }
  }

  return count;
}

async function processEventReminders(
  admin: ReturnType<typeof createAdminClient>,
  dateISO: string,
  label: "today" | "tomorrow"
): Promise<number> {
  // Find events on the target date
  const { data: events } = await admin
    .from("calendar_events")
    .select("id, title, created_by, project_id, projects(name)")
    .eq("event_date", dateISO);

  if (!events || events.length === 0) return 0;

  let count = 0;

  for (const event of events) {
    const recipient = event.created_by;

    // Check preferences
    const { data: profile } = await admin
      .from("profiles")
      .select("notification_preferences")
      .eq("id", recipient)
      .single();

    const prefs = profile?.notification_preferences as Record<string, unknown> | null;
    if (prefs?.event_reminder === false) continue;

    // Deduplicate: check if we already sent this reminder
    const dedupeType = `event_reminder`;
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", recipient)
      .eq("type", dedupeType)
      .contains("metadata", { event_id: event.id, label })
      .limit(1);

    if (existing && existing.length > 0) continue;

    const projectName = Array.isArray(event.projects)
      ? event.projects[0]?.name
      : (event.projects as { name: string } | null)?.name;

    const titleText = label === "tomorrow" ? "Event tomorrow" : "Event today";

    const { data: notification } = await admin
      .from("notifications")
      .insert({
        user_id: recipient,
        type: "event_reminder",
        title: titleText,
        body: event.title + (projectName ? ` — ${projectName}` : ""),
        url: "/plan",
        metadata: { event_id: event.id, project_id: event.project_id, label },
      })
      .select("id, title, body, url, type")
      .single();

    if (notification) {
      await sendPushForNotification(admin, recipient, notification);
      count++;
    }
  }

  return count;
}

async function sendPushForNotification(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  notification: { id: string; title: string; body: string | null; url: string | null; type: string }
) {
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subscriptions || subscriptions.length === 0) return;

  const result = await sendPushToUser(subscriptions, {
    ...notification,
    type: notification.type as "task_assigned" | "task_due_today" | "phase_changed" | "event_reminder",
  });

  await admin
    .from("notifications")
    .update({ push_sent_at: new Date().toISOString() })
    .eq("id", notification.id);

  if (result.expired.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", result.expired);
  }
}
