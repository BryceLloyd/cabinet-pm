# Cabinet PM

## Stack
- Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS
- Supabase (Postgres + Auth + RLS), `@supabase/ssr` for cookie-based auth
- date-fns for all date logic
- Deployed to Vercel at cabinet-pm.vercel.app
- Type check: `npx tsc --noEmit`

## Supabase
- Project: kxspqevihsrgfhwcazro.supabase.co
- Migrations in `supabase/migrations/` numbered sequentially (001, 002, ...)
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
- **PWA / App icon**: Service worker at `public/sw.js` (registered in root layout) enables Chrome PWA install. Icons: `favicon.ico` (BMP-based, 16/32/48px), PNG icons at 48/192/512px, maskable icons at 192/512px, apple-touch-icon at 180px. Manifest in `public/manifest.json`.
- **Middleware static file exclusions**: `middleware.ts` matcher must exclude static assets (`sw.js`, `favicon.*`, `icon.*`, `apple-touch-icon.png`, `manifest.json`) or auth redirects break PWA install and icon loading.
- **Stale `.next` cache**: If runtime errors reference missing chunk files (e.g. `Cannot find module './543.js'`), delete `.next/` and restart.
- **Port conflicts**: Kill all node processes before restarting dev server: `Stop-Process -Name "node" -Force` in PowerShell.
- **PowerShell CWD resets**: Harness resets CWD after each command. Always prefix with `Set-Location` before git/npm commands.
