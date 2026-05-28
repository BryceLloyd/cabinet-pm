# Push Notifications — Design Spec

## Overview

Add in-app and web push notifications to Cabinet PM. Four notification types, per-type user preferences, minimal PWA service worker for push delivery.

**Users:** 2-5 team members on mixed desktop/mobile devices.
**Stack:** Next.js 15 (Vercel) + Supabase (Postgres + Auth + RLS).

## Notification Types

| Type | Trigger | Recipients | Timing |
|------|---------|------------|--------|
| `task_assigned` | DB trigger on `tasks` INSERT/UPDATE when `assigned_to` is set/changed | The assignee (skip if assigner = assignee) | Immediate |
| `task_due_today` | Vercel cron job | Each task's `assigned_to` where `due_date = today` and `completed_at IS NULL` | Daily at 6:00 AM SAST (04:00 UTC) |
| `phase_changed` | DB trigger on `rooms` UPDATE when `current_phase_id` changes | Project creator + all users with tasks in that room. Deduplicate per user per phase change. | Immediate |
| `event_reminder` | Vercel cron job | Event creator (`created_by`) | Day-before: 4:00 PM SAST (14:00 UTC). Morning-of: 6:00 AM SAST (04:00 UTC) |

## Channels

1. **In-app:** Bell icon in header nav with unread badge count. Click opens a dropdown showing recent notifications. "View all" links to `/notifications` full-page list.
2. **Web push:** Browser push notifications via service worker + VAPID. Works on desktop and mobile. Requires user to grant browser permission.

Both channels fire for every notification (if push is enabled). In-app is always available; push is opt-in via browser permission.

## Architecture

**Hybrid approach:** Postgres triggers create notification rows. A Supabase database webhook calls a Next.js API route on Vercel to send web push.

### Flow: Immediate notifications (task_assigned, phase_changed)

1. User action triggers DB change (e.g. assign task)
2. Postgres trigger function checks recipient's `notification_preferences`
3. If enabled for that type, trigger INSERTs into `notifications` table
4. Supabase database webhook fires on `notifications` INSERT
5. Webhook calls `POST /api/push/send` on Vercel
6. API route reads the new notification, queries `push_subscriptions` for that user
7. Sends push via `web-push` npm package to each subscription endpoint
8. Updates `push_sent_at` on the notification row
9. Expired subscriptions (410 response) are deleted from `push_subscriptions`

### Flow: Scheduled notifications (task_due_today, event_reminder)

1. Vercel cron job hits `GET /api/cron/notifications` at scheduled times
2. API route queries for tasks due today / events today or tomorrow
3. Checks each recipient's `notification_preferences`
4. Inserts notification rows for eligible recipients
5. Queries `push_subscriptions` and sends push for each
6. Updates `push_sent_at` on each notification row

### Cron schedule (vercel.json)

```json
{
  "crons": [
    { "path": "/api/cron/notifications", "schedule": "0 4,14 * * *" }
  ]
}
```

- `0 4 * * *` = 6:00 AM SAST — task_due_today + event reminders for today
- `0 14 * * *` = 4:00 PM SAST — event reminders for tomorrow

The API route checks the current UTC hour to determine which notification types to process.

## Data Model

### `notifications` table (new)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid FK → auth.users | Recipient |
| `type` | text NOT NULL | `task_assigned`, `task_due_today`, `phase_changed`, `event_reminder` |
| `title` | text NOT NULL | Short display text |
| `body` | text | Detail text |
| `url` | text | Deep link path (e.g. `/tasks?highlight=uuid`) |
| `metadata` | jsonb | Related IDs for deduplication: `{task_id, project_id, room_id, event_id}` |
| `read_at` | timestamptz | NULL = unread |
| `push_sent_at` | timestamptz | NULL = not yet sent via push |
| `created_at` | timestamptz | `now()` |

**Indexes:**
- `(user_id, created_at DESC)` — bell dropdown query
- `(user_id, read_at)` WHERE `read_at IS NULL` — unread count
- `(push_sent_at)` WHERE `push_sent_at IS NULL` — unsent push queue

**RLS:**
- SELECT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id` (for marking read)
- INSERT: only via trigger functions (SECURITY DEFINER) — no direct client inserts
- DELETE: none (notifications are permanent, just marked read)

### `push_subscriptions` table (new)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid FK → auth.users | |
| `endpoint` | text UNIQUE NOT NULL | Push service URL from browser |
| `p256dh` | text NOT NULL | Public key |
| `auth` | text NOT NULL | Auth secret |
| `user_agent` | text | For debugging |
| `created_at` | timestamptz | `now()` |

**RLS:**
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

### `profiles.notification_preferences` (existing jsonb column)

Default value for new users:

```json
{
  "task_assigned": true,
  "task_due_today": true,
  "phase_changed": true,
  "event_reminder": true
}
```

All enabled by default. Users toggle individual types off in preferences UI.

## Trigger Functions

### `notify_task_assigned()`

- Trigger: `AFTER INSERT OR UPDATE OF assigned_to ON tasks`
- Condition: `NEW.assigned_to IS NOT NULL AND NEW.assigned_to != auth.uid()`
- For UPDATE: only fires if `NEW.assigned_to IS DISTINCT FROM OLD.assigned_to`
- Uses `SECURITY DEFINER` to insert into `notifications`
- Builds title: "Task assigned to you"
- Builds body: task title + project name (joined)
- Builds url: `/tasks?highlight={task_id}`
- Checks recipient's `notification_preferences->>'task_assigned'` before inserting

### `notify_phase_changed()`

- Trigger: `AFTER UPDATE OF current_phase_id ON rooms`
- Condition: `NEW.current_phase_id IS DISTINCT FROM OLD.current_phase_id`
- Uses `SECURITY DEFINER`
- Finds recipients: project creator (`projects.created_by`) + distinct `tasks.assigned_to` for incomplete tasks in that room (`completed_at IS NULL` and `assigned_to IS NOT NULL`)
- Deduplicates recipients
- Builds title: "Phase changed"
- Builds body: room name + " moved to " + phase name
- Builds url: `/projects/{project_id}`
- Checks each recipient's `notification_preferences->>'phase_changed'`

## API Routes

### `POST /api/push/subscribe`

- Auth: requires valid Supabase session
- Body: `{ endpoint, p256dh, auth, userAgent }`
- Upserts into `push_subscriptions` (on conflict `endpoint`, update keys)
- Returns 200

### `POST /api/push/send`

- Auth: webhook secret header (`X-Webhook-Secret`) matching `SUPABASE_WEBHOOK_SECRET` env var
- Body: notification row from webhook payload
- Queries `push_subscriptions` for `notification.user_id`
- Sends push to each subscription via `web-push`
- Push payload: `{ title, body, url, type, notificationId }`
- Updates `push_sent_at` on the notification
- Deletes expired subscriptions (410 from push service)
- Returns 200

### `GET /api/cron/notifications`

- Auth: Vercel cron secret (`CRON_SECRET` env var, verified via `Authorization` header)
- Checks current UTC hour to determine which types to process:
  - Hour 4 (6 AM SAST): `task_due_today` + `event_reminder` for today
  - Hour 14 (4 PM SAST): `event_reminder` for tomorrow
- Uses Supabase service role client (bypasses RLS) to query tasks/events and insert notifications
- Sends push for each inserted notification
- Returns 200 with count of notifications created

### `POST /api/push/unsubscribe`

- Auth: requires valid Supabase session
- Body: `{ endpoint }`
- Deletes matching subscription from `push_subscriptions`
- Returns 200

## Service Worker

### `public/sw.js`

Minimal service worker — push only, no offline caching.

**`push` event:**
- Parses notification data from push payload
- Calls `self.registration.showNotification(title, { body, icon, badge, data: { url } })`
- Icon: app icon from manifest

**`notificationclick` event:**
- Reads `notification.data.url`
- Calls `clients.openWindow(url)` or focuses existing window if app is already open

### Registration

- `lib/push/register-sw.ts` — called from root layout after auth check
- Checks `'serviceWorker' in navigator && 'PushManager' in window`
- Registers `/sw.js`
- Does NOT auto-request permission (soft prompt handles that)

## PWA Manifest

### `public/manifest.json`

```json
{
  "name": "Cabinet PM",
  "short_name": "Cabinet PM",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#18181b",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Linked from `<head>` in root layout. Already excluded from middleware auth matcher.

## UI Components

### Bell Icon + Dropdown (`components/notifications/notification-bell.tsx`)

- Position: header nav bar, left of user avatar
- Bell SVG icon with red badge showing unread count (hidden when 0)
- Click toggles dropdown (Popover or simple positioned div)
- Dropdown: 360px wide, max 5 recent notifications
- Each notification row:
  - Color-coded left border by type (green=task, amber=event, blue=phase)
  - Bold title, grey body text, relative timestamp
  - Unread: tinted background; Read: faded opacity
  - Click: marks as read + navigates to `url`
- Header: "Notifications" + "Mark all read" link
- Footer: "View all notifications" → navigates to `/notifications`
- Closes on click outside or Escape

### Unread count query

Client-side query on mount + Supabase Realtime subscription on `notifications` table filtered by `user_id = auth.uid()`. This is the only place we introduce Realtime — scoped to just the notification count so the bell badge updates without page refresh. The rest of the app continues using polling/refresh.

### Full Notifications Page (`app/(main)/notifications/page.tsx`)

- Route: `/notifications`
- Filter tabs: "All" | "Unread"
- List of all notifications, newest first, capped at 100
- Same row styling as dropdown
- Click marks read + navigates
- Server component with client interactivity for marking read

### Notification Preferences (`components/settings/notification-preferences.tsx`)

- Lives within existing settings/profile page
- Grouped by category with section headers:
  - **Tasks:** Task assigned, Task due today
  - **Pipeline:** Phase changes
  - **Calendar:** Event reminders
- Toggle switch per type, auto-saves to `profiles.notification_preferences` with 800ms debounce
- Push permission banner at top:
  - "Enabled ✓" (green) if permission granted
  - "Enable push notifications" button if permission is `default`
  - "Push blocked — enable in browser settings" if permission is `denied`

### Push Soft Prompt (`components/notifications/push-prompt.tsx`)

- Appears at top of dashboard on first visit after login when push permission is `default`
- Dismissible banner: "Get notified about tasks and events — Enable push notifications"
- "Enable" button triggers `Notification.requestPermission()`
- Dismissed state stored in localStorage (doesn't nag)
- If granted → subscribes to push + hides banner
- If denied → hides banner
- Users can always enable later from notification preferences

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel + local .env | VAPID public key for push subscription |
| `VAPID_PRIVATE_KEY` | Vercel only (secret) | VAPID private key for sending push |
| `SUPABASE_WEBHOOK_SECRET` | Vercel + Supabase dashboard | Authenticates webhook calls from Supabase |
| `CRON_SECRET` | Vercel (auto-set for Vercel cron) | Authenticates cron endpoint |

## Dependencies

- `web-push` — npm package for sending push notifications from Node.js

No other new dependencies. Service worker is vanilla JS.

## Migration Sequence

1. Create `notifications` table with indexes and RLS policies
2. Create `push_subscriptions` table with RLS policies
3. Create `notify_task_assigned()` trigger function + trigger
4. Create `notify_phase_changed()` trigger function + trigger
5. Set default value for `profiles.notification_preferences` (backfill existing rows)
6. Create Supabase database webhook on `notifications` INSERT → Vercel endpoint

## Out of Scope

- Email digests (BRIEF_008 — separate effort after this is validated)
- Offline caching / full PWA offline support
- Per-channel preferences (in-app vs push per type)
- Notification grouping/batching (e.g. "3 tasks assigned" as one notification)
- Admin notification management
- Sound/vibration customization
