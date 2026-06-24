# Cabinet PM

## Stack
- Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS
- Supabase (Postgres + Auth + RLS), `@supabase/ssr` for cookie-based auth
- date-fns for all date logic
- `web-push` for VAPID-based push notifications
- Deployed to Vercel at cabinet-pm.vercel.app
- Type check: `npx tsc --noEmit`

## Supabase
- Project: kxspqevihsrgfhwcazro.supabase.co
- Migrations in `supabase/migrations/` numbered sequentially (001, 002, ...)
- **CLI is installed + linked**: `supabase db push` applies migrations to the remote DB; `supabase db query "<SQL>" --linked` runs SQL against remote (inspect/repair data — no Docker needed); `supabase db dump`/`db diff` need Docker (not available here). Migrations get applied to the live DB during development, not just on deploy.
- **Migration versions must be unique**: the numeric filename prefix IS the version — duplicate prefixes break `db push`. Fix by renumbering + `supabase migration repair --status applied/reverted <version>` (and `db query` to remap `supabase_migrations.schema_migrations` if names drift).
- **RLS + triggers gotcha**: Triggers that don't use SECURITY DEFINER run as the calling user. They need their own INSERT/UPDATE RLS policies on any table they write to, or client-side operations will 403.
- Auth uses middleware.ts to refresh JWT via `getUser()` on every request

## Patterns & Gotchas
- **Next.js scroll restoration**: `scrollIntoView` in `useLayoutEffect` gets overridden by App Router scroll restoration. Use `useEffect` + `setTimeout(100ms)` + `window.scrollTo` with computed offset instead.
- **CSS ring bleeds on mobile**: `ring-*` (box-shadow) bleeds through sticky headers when scrolling. Use `border-*` instead for elements that scroll under sticky containers.
- **SVG + sticky**: CSS `position: sticky` doesn't work on SVG elements. Split into HTML labels + SVG content for sticky column layouts.
- **Mobile detection**: ResizeObserver on container, `containerW < 640` breakpoint (not window width).
- **Voice input**: User sometimes uses voice input — watch for misinterpretations.
- **Supabase `.select()` joins**: Foreign-key joins (e.g. `projects(name)`) return arrays in TypeScript types, not single objects. Normalize with `Array.isArray(x) ? x[0] : x` before use.
- **Server component caching**: All Supabase queries in server components must use `cache: 'no-store'` (configured in `lib/supabase/server.ts`) or Next.js may serve stale data.
- **Dashboard cards**: Registry in `lib/dashboard/card-registry.ts`, layouts persisted in localStorage per user. When renaming a card type, add migration in `getLayout()` in `dashboard-layout.ts`.
- **Mobile FAB**: `components/mobile-fab.tsx` controls which pill appears per route. `components/mobile-fab-drawer.tsx` has all drawer views (vaul Drawer). Add new `FabDrawerMode` to the union type + matching view in the drawer.
- **Desktop floating pills**: Each main page has a `fixed bottom-6 right-6 z-40` pill FAB (hidden on mobile via `hidden md:inline-flex`). Dashboard pill opens a quick-add popover (project/task/event). Tasks, Projects, Year Plan pills open their respective SlidePanel create forms.
- **SlidePanel** (`components/ui/slide-panel.tsx`): Shared panel component — desktop slides from right (380px), mobile bottom sheet (drag-to-dismiss). Uses `visualViewport` API to resize when mobile keyboard opens and auto-scrolls focused inputs into view. Supports `showClose` prop (default true) to hide the header X button.
- **Add panels**: `AddTaskPanel`, `AddEventPanel`, `AddProjectPanel` all use SlidePanel with explicit submit buttons. Both desktop and mobile add-task forms include all fields (title, type, due date, project, room group, room, assignee, notes) and default assignee to the current user.
- **Task detail panel**: Uses SlidePanel with `showClose={false}` (no header X button). Actions at bottom: small "Delete task" link with inline confirmation, Complete button, Done button. Auto-saves fields with 800ms debounce.
- **Task types**: `task_types` table with color-coded badges. Settings CRUD in `components/settings/task-type-manager.tsx`. "My tasks" view groups by type with colored dot headers; other filters show flat table with type column.
- **Dashboard detail panels**: Dashboard cards pass `onTaskClick`/`onEventClick` callbacks via `CardProps`. The grid fetches full records and opens `TaskDetailPanel`/`EventDetailPanel`. To add click-to-open on a new card, use the optional callbacks from `CardProps`.
- **Phase plans**: `phase_plans` table stores per-project phase schedules. `is_default` boolean tracks whether a plan follows the phase default duration or was manually overridden. When `default_duration_days` changes in settings, `sync_phase_defaults` RPC recalculates all default plans. Plans are generated working backwards from the project's completion date.
- **ProjectPhasePlan** (`components/projects/project-phase-plan.tsx`): Self-contained component — loads/generates phase plans, renders 4-month Gantt with grey lead time bar + thin phase overlay, editable duration list. Auto-generates plans on first visit if none exist.
- **Gantt phase overlay**: Both project detail and year plan Gantt charts show a thin colored phase strip over the grey lead time bar. Year plan uses SVG `<rect>` elements; project detail uses CSS flex with `dp.days` as flex values.
- **Mobile list density**: Mobile card lists use compact spacing (px-3 py-2 cards, space-y-1.5 gaps) across tasks, projects, and events pages to fit more items per screen.
- **Mobile FAB drawer**: `max-h-[85vh] flex flex-col` with `overflow-y-auto` on the content div so long forms (like add-task with all fields) scroll within the drawer.
- **PWA / App icon**: Service worker at `public/sw.js` (registered in root layout) enables Chrome PWA install + push notification handling. Icons: `favicon.ico` (BMP-based, 16/32/48px), PNG icons at 48/192/512px, maskable icons at 192/512px, apple-touch-icon at 180px. Manifest in `public/manifest.json`.
- **Notifications system**: 4 types: `task_assigned`, `task_due_today`, `phase_changed`, `event_reminder`. DB triggers auto-create rows for task_assigned and phase_changed. Vercel cron (`/api/cron/notifications`) handles due-today and event-reminder daily. Supabase database webhook on `notifications` INSERT calls `/api/push/send` to deliver web push. Bell component (`notification-bell.tsx`) uses Supabase Realtime for live unread badge.
- **Push subscriptions**: `push_subscriptions` table stores browser push endpoints per user. Subscribe/unsubscribe via `/api/push/subscribe` and `/api/push/unsubscribe`. VAPID keys in env vars. Service worker handles push display and notification click navigation.
- **Notification preferences**: Stored in `profiles.notification_preferences` JSONB column. Grouped toggles (Tasks/Pipeline/Calendar) in settings. 800ms debounce auto-save. Push permission banner shows when browser permission not yet granted.
- **Middleware static file exclusions**: `middleware.ts` matcher must exclude static assets (`sw.js`, `favicon.*`, `icon.*`, `apple-touch-icon.png`, `manifest.json`) or auth redirects break PWA install and icon loading.
- **Stale `.next` cache**: If runtime errors reference missing chunk files (e.g. `Cannot find module './543.js'`), delete `.next/` and restart.
- **Port conflicts**: Kill all node processes before restarting dev server: `Stop-Process -Name "node" -Force` in PowerShell.
- **PowerShell CWD resets**: Harness resets CWD after each command. Always prefix with `Set-Location` before git/npm commands.
- **`npm run build` clobbers a running dev server's `.next`**: while `next dev` is up (e.g. for preview), verify with `npx tsc --noEmit` + the live preview instead of a full build.
- **Preview test users**: create via the GoTrue admin API (`POST {url}/auth/v1/admin/users` with the service-role key + `email_confirm:true`), then INSERT a `public.profiles` row manually — the signup trigger gates on `allowed_emails`, so admin-created users get no profile otherwise. Clean up the user + profile after.
- **Claude Preview MCP renders <768px** by default ("desktop" preset ≈687px, below the `md:` breakpoint); `preview_resize` to width ≥768 to see the true desktop layout. `window.location.href` mid-`preview_eval` throws "target navigated" — navigate in one call, assert in the next.

## Production area
- **Office vs Production views**: per-user `profiles.office_access`/`production_access` (admins always have both) gate the two views, enforced in `middleware.ts`. The `Office | Production` toggle (`components/view-switch.tsx`) swaps the header nav (`components/header-nav.tsx`, view-aware by pathname). Production nav lives in the main header (no sub-rail); set per-user access in Settings → Team.
- **Factory grouping**: the `Factory` nav item groups the cut-edge / painting / assembly stages and shows `components/production/factory-sub-nav.tsx` on those pages. Production settings live under the user-icon menu, routes under `app/(app)/production/settings/`.
- **Production model**: configurable `production_stages`/`production_steps`; per-cutlist `production_items`(+`production_item_steps`) are auto-generated by the `generate_production_items(cutlist_id)` RPC (SECURITY DEFINER) — call it client-side after creating/editing a cutlist's rooms or material orders. Cut & edge steps differ by supplier kind via `production_steps.applies_to`. Aggregation/queries in `lib/production/queries.ts`.
- **`production_items` uniqueness MUST include `cutlist_id`** — `(cutlist_id, stage_id, ref_type, ref_id)`. A shared room/material `ref_id` collides across cutlists otherwise and `on conflict do nothing` silently skips items.
- **Reseeding steps**: a migration that cascade-deletes `production_steps` (re-seed) must backfill by re-running `generate_production_items` for every existing cutlist (see migration 022).
- **Hardware orders** are first-class: `hardware_orders` + `hardware_order_items` (per-item `supplier_id` + `status`), shown grouped by (order × supplier) batch — one order can span suppliers.
- **Suppliers** split by `suppliers.category` (`cut_edge` | `hardware`) into two settings lists; `materials`/`hardware_catalog` carry `default_supplier_id` that auto-fills the supplier when ordering.
- **dnd-kit reorder** (`components/production/draggable-list.tsx`): give each `DndContext` a stable `id` when multiple drag lists render on one page, or SSR/client `aria-describedby` ids mismatch (hydration warning).
