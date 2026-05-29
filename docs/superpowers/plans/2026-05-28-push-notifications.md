# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-app bell notifications and web push to Cabinet PM — 4 notification types (task assigned, task due today, phase changed, event reminder), per-type user preferences, minimal PWA service worker.

**Architecture:** Hybrid — Postgres triggers insert notification rows for immediate events (task assigned, phase changed). Vercel cron inserts rows for scheduled events (task due today, event reminders). A Supabase database webhook calls a Next.js API route to send web push via the `web-push` npm package. In-app bell uses Supabase Realtime for live unread count.

**Tech Stack:** Next.js 15, Supabase (Postgres + RLS + Realtime), `web-push` npm package, vanilla JS service worker, Vercel cron.

**Spec:** `docs/superpowers/specs/2026-05-28-push-notifications-design.md`

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/015_notifications.sql` | `notifications` table, `push_subscriptions` table, RLS, indexes, triggers, preference backfill |
| `lib/types/notifications.ts` | TypeScript types for Notification, PushSubscription, NotificationPreferences |
| `lib/push/register-sw.ts` | Service worker registration + push subscription helper |
| `lib/push/send.ts` | Server-side push sending via `web-push` (shared by webhook + cron routes) |
| `lib/supabase/admin.ts` | Supabase service-role client for cron/webhook routes that bypass RLS |
| `public/sw.js` | Service worker — push event + notification click handling |
| `app/api/push/subscribe/route.ts` | Save push subscription from browser |
| `app/api/push/unsubscribe/route.ts` | Remove push subscription |
| `app/api/push/send/route.ts` | Webhook endpoint — receives notification INSERT, sends push |
| `app/api/cron/notifications/route.ts` | Vercel cron — task_due_today + event_reminder |
| `components/notifications/notification-bell.tsx` | Bell icon + dropdown in header |
| `components/notifications/notification-item.tsx` | Single notification row (shared by dropdown + full page) |
| `components/notifications/push-prompt.tsx` | Soft prompt banner for dashboard |
| `components/settings/notification-preferences.tsx` | Grouped toggle UI for settings page |
| `app/(app)/notifications/page.tsx` | Full notifications list page |
| `app/(app)/settings/notifications/page.tsx` | Settings page shell for notification preferences |
| `vercel.json` | Cron schedule config |

### Modified files

| File | Change |
|------|--------|
| `lib/types.ts` | Add re-export from `lib/types/notifications.ts` |
| `app/(app)/layout.tsx` | Add `<NotificationBell />` to header, add `<ServiceWorkerRegister />` |
| `app/(app)/settings/layout.tsx` | Add "Notifications" to `SETTINGS_NAV` |
| `middleware.ts` | Add `sw.js` to matcher exclusion |
| `public/manifest.json` | No changes needed — existing SVG icon works for push |
| `package.json` | Add `web-push` dependency |

---

## Task 1: Install dependency and create types

**Files:**
- Modify: `package.json`
- Create: `lib/types/notifications.ts`
- Modify: `lib/types.ts`

- [ ] **Step 1: Install web-push**

Run:
```bash
npm install web-push
npm install -D @types/web-push
```

- [ ] **Step 2: Create notification types**

Create `lib/types/notifications.ts`:

```ts
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
```

- [ ] **Step 3: Re-export from lib/types.ts**

Add at the bottom of `lib/types.ts`:

```ts
export type {
  NotificationType,
  Notification,
  PushSubscriptionRecord,
  NotificationPreferences,
} from "./types/notifications";
export { DEFAULT_NOTIFICATION_PREFERENCES } from "./types/notifications";
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/types/notifications.ts lib/types.ts
git commit -m "feat(notifications): add web-push dependency and notification types"
```

---

## Task 2: Database migration — tables, indexes, RLS, triggers

**Files:**
- Create: `supabase/migrations/015_notifications.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/015_notifications.sql`:

```sql
-- Migration 015: Notifications & Push Subscriptions
-- In-app + web push notification system.

----------------------------------------------------------------------
-- 1. notifications table
----------------------------------------------------------------------
CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN (
                'task_assigned', 'task_due_today', 'phase_changed', 'event_reminder'
              )),
  title       text NOT NULL,
  body        text,
  url         text,
  metadata    jsonb,
  read_at     timestamptz,
  push_sent_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_idx
  ON notifications (user_id, created_at DESC);

CREATE INDEX notifications_user_unread_idx
  ON notifications (user_id)
  WHERE read_at IS NULL;

CREATE INDEX notifications_push_unsent_idx
  ON notifications (id)
  WHERE push_sent_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark read)
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Triggers insert via SECURITY DEFINER — need a service-role policy
-- so the trigger functions can insert for any user.
CREATE POLICY "notifications_insert_trigger"
  ON notifications FOR INSERT
  WITH CHECK (true);

----------------------------------------------------------------------
-- 2. push_subscriptions table
----------------------------------------------------------------------
CREATE TABLE push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text UNIQUE NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_select_own"
  ON push_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_insert_own"
  ON push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_update_own"
  ON push_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_delete_own"
  ON push_subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

----------------------------------------------------------------------
-- 3. Backfill notification_preferences with defaults
----------------------------------------------------------------------
UPDATE profiles
SET notification_preferences = '{
  "task_assigned": true,
  "task_due_today": true,
  "phase_changed": true,
  "event_reminder": true
}'::jsonb
WHERE notification_preferences = '{}'::jsonb
   OR notification_preferences IS NULL;

-- Update default for new profiles
ALTER TABLE profiles
  ALTER COLUMN notification_preferences
  SET DEFAULT '{
    "task_assigned": true,
    "task_due_today": true,
    "phase_changed": true,
    "event_reminder": true
  }'::jsonb;

----------------------------------------------------------------------
-- 4. notify_task_assigned() trigger function
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs jsonb;
  v_project_name text;
BEGIN
  -- Only fire if assigned_to is set and changed
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, skip if assigned_to didn't change
  IF TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  -- Don't notify if you assigned to yourself
  IF NEW.assigned_to = NEW.created_by THEN
    RETURN NEW;
  END IF;

  -- Check recipient preferences
  SELECT notification_preferences INTO v_prefs
  FROM profiles WHERE id = NEW.assigned_to;

  IF COALESCE(v_prefs->>'task_assigned', 'true') = 'false' THEN
    RETURN NEW;
  END IF;

  -- Get project name for the notification body
  SELECT p.name INTO v_project_name
  FROM projects p WHERE p.id = NEW.project_id;

  INSERT INTO notifications (user_id, type, title, body, url, metadata)
  VALUES (
    NEW.assigned_to,
    'task_assigned',
    'Task assigned to you',
    NEW.title || COALESCE(' — ' || v_project_name, ''),
    '/tasks?highlight=' || NEW.id,
    jsonb_build_object('task_id', NEW.id, 'project_id', NEW.project_id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_task_assigned
  AFTER INSERT OR UPDATE OF assigned_to ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_assigned();

----------------------------------------------------------------------
-- 5. notify_phase_changed() trigger function
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_phase_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_project_creator uuid;
  v_room_name text;
  v_phase_name text;
  v_recipient uuid;
BEGIN
  -- Only fire if phase actually changed
  IF NEW.current_phase_id IS NOT DISTINCT FROM OLD.current_phase_id THEN
    RETURN NEW;
  END IF;

  -- Get room and phase info
  v_room_name := NEW.name;
  v_project_id := NEW.project_id;

  SELECT name INTO v_phase_name
  FROM phases WHERE id = NEW.current_phase_id;

  SELECT created_by INTO v_project_creator
  FROM projects WHERE id = v_project_id;

  -- Collect recipients: project creator + users with incomplete tasks in this room
  FOR v_recipient IN
    SELECT DISTINCT unnest(ARRAY[v_project_creator] ||
      ARRAY(
        SELECT DISTINCT t.assigned_to
        FROM tasks t
        WHERE t.room_id = NEW.id
          AND t.completed_at IS NULL
          AND t.assigned_to IS NOT NULL
      )
    )
  LOOP
    -- Skip nulls
    IF v_recipient IS NULL THEN
      CONTINUE;
    END IF;

    -- Check recipient preferences
    IF (SELECT COALESCE(notification_preferences->>'phase_changed', 'true')
        FROM profiles WHERE id = v_recipient) = 'false' THEN
      CONTINUE;
    END IF;

    INSERT INTO notifications (user_id, type, title, body, url, metadata)
    VALUES (
      v_recipient,
      'phase_changed',
      'Phase changed',
      v_room_name || ' moved to ' || COALESCE(v_phase_name, 'unknown'),
      '/projects/' || v_project_id,
      jsonb_build_object('room_id', NEW.id, 'project_id', v_project_id, 'phase_id', NEW.current_phase_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_phase_changed
  AFTER UPDATE OF current_phase_id ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION notify_phase_changed();
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
npx supabase db push
```

If using remote (hosted Supabase), apply via the Supabase dashboard SQL editor or `supabase db push --linked`.

Expected: Tables `notifications` and `push_subscriptions` created, triggers active, preferences backfilled.

- [ ] **Step 3: Verify the migration**

Run in Supabase SQL editor:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('notifications', 'push_subscriptions');

-- Check triggers exist
SELECT trigger_name, event_object_table FROM information_schema.triggers
WHERE trigger_name IN ('trg_notify_task_assigned', 'trg_notify_phase_changed');

-- Check preferences backfill
SELECT id, notification_preferences FROM profiles LIMIT 5;
```

Expected: Both tables listed, both triggers listed, all profiles have the 4-key preferences object.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/015_notifications.sql
git commit -m "feat(notifications): add notifications and push_subscriptions tables with triggers"
```

---

## Task 3: Supabase admin client + push sending utility

**Files:**
- Create: `lib/supabase/admin.ts`
- Create: `lib/push/send.ts`

- [ ] **Step 1: Create admin client**

Create `lib/supabase/admin.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client using the service_role key.
 * Bypasses RLS — use only in server-side API routes (cron, webhooks).
 * NEVER import this in client components or server components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 2: Create push sending utility**

Create `lib/push/send.ts`:

```ts
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
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/admin.ts lib/push/send.ts
git commit -m "feat(notifications): add admin Supabase client and push sending utility"
```

---

## Task 4: Push subscribe/unsubscribe API routes

**Files:**
- Create: `app/api/push/subscribe/route.ts`
- Create: `app/api/push/unsubscribe/route.ts`

- [ ] **Step 1: Create subscribe route**

Create `app/api/push/subscribe/route.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { endpoint, p256dh, auth, userAgent } = await request.json();

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Upsert: if this endpoint already exists, update the keys
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent || null,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("Failed to save push subscription:", error);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create unsubscribe route**

Create `app/api/push/unsubscribe/route.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { endpoint } = await request.json();

  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/push/subscribe/route.ts app/api/push/unsubscribe/route.ts
git commit -m "feat(notifications): add push subscribe/unsubscribe API routes"
```

---

## Task 5: Push send webhook API route

**Files:**
- Create: `app/api/push/send/route.ts`

- [ ] **Step 1: Create send route**

Create `app/api/push/send/route.ts`:

```ts
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
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/push/send/route.ts
git commit -m "feat(notifications): add push send webhook API route"
```

---

## Task 6: Cron API route for scheduled notifications

**Files:**
- Create: `app/api/cron/notifications/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Create cron route**

Create `app/api/cron/notifications/route.ts`:

```ts
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
```

- [ ] **Step 2: Create vercel.json**

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/notifications",
      "schedule": "0 5,14 * * *"
    }
  ]
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/notifications/route.ts vercel.json
git commit -m "feat(notifications): add Vercel cron route for scheduled notifications"
```

---

## Task 7: Service worker + registration utility

**Files:**
- Create: `public/sw.js`
- Create: `lib/push/register-sw.ts`
- Modify: `middleware.ts`

- [ ] **Step 1: Create service worker**

Create `public/sw.js`:

```js
// Cabinet PM — Push notification service worker
// Minimal: handles push events and notification clicks only. No offline caching.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }

  const options = {
    body: data.body || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: { url: data.url || "/dashboard" },
    tag: data.notificationId || undefined,
  };

  event.waitUntil(self.registration.showNotification(data.title || "Cabinet PM", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow(url);
    })
  );
});
```

- [ ] **Step 2: Create registration utility**

Create `lib/push/register-sw.ts`:

```ts
/**
 * Register the service worker and optionally subscribe to push.
 * Call from a client component after auth is confirmed.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    return registration;
  } catch (err) {
    console.error("Service worker registration failed:", err);
    return null;
  }
}

/**
 * Subscribe to push notifications after user grants permission.
 * Returns the PushSubscription or null if not possible.
 */
export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.warn("VAPID public key not set");
    return null;
  }

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    // Send subscription to server
    const p256dh = subscription.getKey("p256dh");
    const auth = subscription.getKey("auth");

    if (!p256dh || !auth) return null;

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh: arrayBufferToBase64(p256dh),
        auth: arrayBufferToBase64(auth),
        userAgent: navigator.userAgent,
      }),
    });

    return subscription;
  } catch (err) {
    console.error("Push subscription failed:", err);
    return null;
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  await subscription.unsubscribe();
}

// --- Helpers ---

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
```

- [ ] **Step 3: Update middleware to exclude sw.js**

In `middleware.ts`, update the matcher to exclude `sw.js`:

Change:
```ts
  matcher: ["/((?!_next|favicon.ico|auth/callback|manifest.json|icon).*)"],
```

To:
```ts
  matcher: ["/((?!_next|favicon.ico|auth/callback|manifest.json|icon|sw\\.js).*)"],
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add public/sw.js lib/push/register-sw.ts middleware.ts
git commit -m "feat(notifications): add service worker, registration utility, and middleware exclusion"
```

---

## Task 8: Notification bell component

**Files:**
- Create: `components/notifications/notification-item.tsx`
- Create: `components/notifications/notification-bell.tsx`

- [ ] **Step 1: Create notification item component**

This component is shared between the dropdown and the full page.

Create `components/notifications/notification-item.tsx`:

```tsx
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
```

- [ ] **Step 2: Create notification bell component**

Create `components/notifications/notification-bell.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NotificationItem } from "./notification-item";
import type { Notification } from "@/lib/types/notifications";

export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch recent notifications
  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) setNotifications(data as Notification[]);
  }, [supabase, userId]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);

    setUnreadCount(count || 0);
  }, [supabase, userId]);

  // Initial fetch
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Realtime subscription for unread count updates
  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchUnreadCount();
          if (open) fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, open, fetchUnreadCount, fetchNotifications]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  async function handleMarkRead(notificationId: string) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function handleMarkAllRead() {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);

    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setUnreadCount(0);
  }

  function handleNavigate(url: string) {
    setOpen(false);
    router.push(url);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-semibold">Notifications</span>
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
          <div className="max-h-[340px] overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={handleMarkRead}
                  onNavigate={handleNavigate}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t">
              <button
                type="button"
                onClick={() => { setOpen(false); router.push("/notifications"); }}
                className="w-full px-4 py-2.5 text-xs text-center text-emerald-600 hover:bg-muted transition-colors"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add components/notifications/notification-item.tsx components/notifications/notification-bell.tsx
git commit -m "feat(notifications): add notification bell dropdown component with Realtime"
```

---

## Task 9: Integrate bell into app layout + push prompt

**Files:**
- Modify: `app/(app)/layout.tsx`
- Create: `components/notifications/push-prompt.tsx`

- [ ] **Step 1: Create push prompt component**

Create `components/notifications/push-prompt.tsx`:

```tsx
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
```

- [ ] **Step 2: Add bell and push prompt to app layout**

In `app/(app)/layout.tsx`:

Add import at the top:
```ts
import { NotificationBell } from "@/components/notifications/notification-bell";
```

In the header, add the bell icon **before** the `<UserMenu>` component. Find the section:
```tsx
          <div className="flex items-center gap-1 md:gap-4">
            <nav className="hidden md:flex items-center gap-1">
```

Replace the entire `<div className="flex items-center gap-1 md:gap-4">` block with:
```tsx
          <div className="flex items-center gap-1 md:gap-4">
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <NotificationBell userId={user.id} />
            <UserMenu
              fullName={profile.full_name}
              email={user.email || ""}
              role={profile.role}
              avatarUrl={profile.avatar_url || null}
            />
          </div>
```

The `<PushPrompt />` should only appear on the dashboard, not every page. It will be added to the dashboard page in this step instead of the layout.

Find the dashboard page at `app/(app)/dashboard/page.tsx`. Add the import at the top:
```ts
import { PushPrompt } from "@/components/notifications/push-prompt";
```

Then add `<PushPrompt />` as the first child inside the page's outermost container div, before any existing content:
```tsx
<PushPrompt />
```

- [ ] **Step 3: Register service worker on layout mount**

The service worker registration needs to happen on the client side. Since `PushPrompt` already imports `registerServiceWorker`, we also need the service worker registered even when the prompt is dismissed (for receiving push). Add a small client component wrapper.

Create `components/notifications/sw-register.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/push/register-sw";

export function ServiceWorkerRegister() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return null;
}
```

Add to `app/(app)/layout.tsx` imports:
```ts
import { ServiceWorkerRegister } from "@/components/notifications/sw-register";
```

Add right before the closing `</div>` of the root element:
```tsx
      <BottomTabBar />
      <MobileFab />
      <ServiceWorkerRegister />
    </div>
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add components/notifications/push-prompt.tsx components/notifications/sw-register.tsx app/\(app\)/layout.tsx app/\(app\)/dashboard/page.tsx
git commit -m "feat(notifications): integrate bell icon, push prompt, and service worker into app"
```

---

## Task 10: Full notifications page

**Files:**
- Create: `app/(app)/notifications/page.tsx`

- [ ] **Step 1: Create notifications page**

Create `app/(app)/notifications/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NotificationsPageClient } from "./notifications-client";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="container py-6 md:py-8 px-4 max-w-2xl">
      <h1 className="text-lg font-semibold mb-4">Notifications</h1>
      <NotificationsPageClient
        initialNotifications={notifications || []}
        userId={user.id}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the client component**

Create `app/(app)/notifications/notifications-client.tsx`:

```tsx
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
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/notifications/page.tsx app/\(app\)/notifications/notifications-client.tsx
git commit -m "feat(notifications): add full notifications page with filter tabs"
```

---

## Task 11: Notification preferences settings page

**Files:**
- Create: `components/settings/notification-preferences.tsx`
- Create: `app/(app)/settings/notifications/page.tsx`
- Modify: `app/(app)/settings/layout.tsx`

- [ ] **Step 1: Create notification preferences component**

Create `components/settings/notification-preferences.tsx`:

```tsx
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
      saveTimeout.current = setTimeout(() => {
        supabase
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
```

- [ ] **Step 2: Create settings page**

Create `app/(app)/settings/notifications/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/types/notifications";

export default async function NotificationSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", user.id)
    .single();

  const prefs = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(profile?.notification_preferences as Record<string, boolean> || {}),
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Notifications</h2>
      <p className="text-sm text-muted-foreground mb-6">Choose which notifications you receive</p>
      <NotificationPreferencesForm userId={user.id} initialPreferences={prefs} />
    </div>
  );
}
```

- [ ] **Step 3: Add Notifications to settings nav**

In `app/(app)/settings/layout.tsx`, add the Bell icon import and nav entry.

Add to imports:
```ts
import { User, Building2, Users, Layers, CalendarDays, ChevronLeft, Bell } from "lucide-react";
```

Update `SETTINGS_NAV` to include the Notifications entry:
```ts
const SETTINGS_NAV = [
  { href: "/settings/profile", label: "Profile", icon: User },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/business", label: "Business", icon: Building2 },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/phases", label: "Phases", icon: Layers },
  { href: "/settings/event-types", label: "Event types", icon: CalendarDays },
] as const;
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add components/settings/notification-preferences.tsx app/\(app\)/settings/notifications/page.tsx app/\(app\)/settings/layout.tsx
git commit -m "feat(notifications): add notification preferences page in settings"
```

---

## Task 12: Update manifest + generate VAPID keys + env setup

**Files:**
- Modify: `public/manifest.json`
- Modify: `middleware.ts` (already done in Task 7 — verify)

- [ ] **Step 1: Update manifest.json**

The existing `manifest.json` only has an SVG icon. Push notifications need a raster icon for the notification tray. For now, keep the SVG (browsers that support it will use it), and note that raster icons (192px, 512px PNG) should be added when available.

No changes needed to `manifest.json` — the existing SVG icon will work for push notifications on most browsers. When raster PNGs are available, add them as additional icon entries.

- [ ] **Step 2: Generate VAPID keys**

Run:
```bash
npx web-push generate-vapid-keys
```

This outputs a public and private key pair. Copy them.

- [ ] **Step 3: Set environment variables locally**

Add to `.env.local` (create if it doesn't exist):

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<the public key from step 2>
VAPID_PRIVATE_KEY=<the private key from step 2>
SUPABASE_SERVICE_ROLE_KEY=<your Supabase service role key from dashboard>
SUPABASE_WEBHOOK_SECRET=<generate a random string, e.g. openssl rand -hex 32>
```

- [ ] **Step 4: Set environment variables on Vercel**

In the Vercel dashboard → Settings → Environment Variables, add:

| Name | Value | Environments |
|------|-------|-------------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | public key | All |
| `VAPID_PRIVATE_KEY` | private key | All |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key | All |
| `SUPABASE_WEBHOOK_SECRET` | webhook secret | All |

`CRON_SECRET` is auto-set by Vercel for cron endpoints.

- [ ] **Step 5: Commit .env.example**

Create `.env.example` (or update existing) with the new variables:

```
# Push notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_WEBHOOK_SECRET=
```

```bash
git add .env.example
git commit -m "docs: add push notification env vars to .env.example"
```

---

## Task 13: Configure Supabase database webhook

This is a manual step in the Supabase dashboard — not code.

- [ ] **Step 1: Create database webhook in Supabase**

Go to Supabase Dashboard → Database → Webhooks → Create webhook:

- **Name:** `notify_push_send`
- **Table:** `notifications`
- **Events:** `INSERT`
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://cabinet-pm.vercel.app/api/push/send`
- **Headers:**
  - `Content-Type: application/json`
  - `X-Webhook-Secret: <the SUPABASE_WEBHOOK_SECRET value from your env>`

- [ ] **Step 2: Test the webhook**

Insert a test notification via SQL in the Supabase SQL editor:

```sql
INSERT INTO notifications (user_id, type, title, body, url)
VALUES (
  (SELECT id FROM profiles LIMIT 1),
  'task_assigned',
  'Test notification',
  'This is a test push notification',
  '/dashboard'
);
```

Check the Vercel function logs to confirm the webhook was received at `/api/push/send`.

---

## Task 14: Enable Supabase Realtime for notifications table

This is a manual step — Supabase Realtime needs the `notifications` table added to the Realtime publication.

- [ ] **Step 1: Enable Realtime on notifications table**

In Supabase Dashboard → Database → Tables → `notifications` → click the "Realtime" toggle to enable.

Or run in the SQL editor:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

- [ ] **Step 2: Verify Realtime works**

Open the app in two tabs. In one tab, insert a notification via SQL. The bell icon badge in the other tab should update without page refresh.

---

## Task 15: Smoke test end-to-end

- [ ] **Step 1: Test task_assigned trigger**

1. Open the app and navigate to Tasks
2. Create a task and assign it to another team member
3. Expected: A notification row appears in the `notifications` table for the assignee
4. Expected: The assignee's bell icon shows an unread badge (if they have the app open)
5. Expected: If the assignee has push enabled, they receive a browser notification

- [ ] **Step 2: Test phase_changed trigger**

1. Navigate to a project with rooms
2. Change a room's phase
3. Expected: Notifications created for the project creator and any users with tasks in that room

- [ ] **Step 3: Test notification preferences**

1. Go to Settings → Notifications
2. Toggle off "Task assigned"
3. Assign a new task to yourself from another account
4. Expected: No notification created (trigger checks preferences)
5. Toggle it back on

- [ ] **Step 4: Test push prompt**

1. Clear localStorage (`localStorage.removeItem("push-prompt-dismissed")`)
2. Refresh the dashboard
3. Expected: Green banner appears at top asking to enable push
4. Click "Enable" → browser permission prompt
5. If granted → banner disappears, push subscription saved to `push_subscriptions` table

- [ ] **Step 5: Test notification bell dropdown**

1. Click the bell icon
2. Expected: Dropdown shows recent notifications, color-coded by type
3. Click a notification → marks as read + navigates to the linked page
4. Click "Mark all read" → all notifications marked as read, badge disappears

- [ ] **Step 6: Test /notifications page**

1. Click "View all notifications" in the dropdown
2. Expected: Full page list with All/Unread filter tabs
3. Toggle to "Unread" → shows only unread items

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix(notifications): smoke test fixes"
```

(Only if fixes were needed during testing.)
