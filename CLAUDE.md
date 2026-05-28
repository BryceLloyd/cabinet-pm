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
- **SlidePanel** (`components/ui/slide-panel.tsx`): Shared panel component — desktop slides from right (380px), mobile bottom sheet (drag-to-dismiss). Uses `visualViewport` API to resize when mobile keyboard opens and auto-scrolls focused inputs into view.
- **Add panels**: `AddTaskPanel`, `AddEventPanel`, `AddProjectPanel` all use SlidePanel with explicit submit buttons. Edit/detail panels (`TaskDetailPanel`, `EventDetailPanel`) use auto-save with 800ms debounce.
- **Stale `.next` cache**: If runtime errors reference missing chunk files (e.g. `Cannot find module './543.js'`), delete `.next/` and restart.
- **Port conflicts**: Kill all node processes before restarting dev server: `Stop-Process -Name "node" -Force` in PowerShell.
- **PowerShell CWD resets**: Harness resets CWD after each command. Always prefix with `Set-Location` before git/npm commands.
