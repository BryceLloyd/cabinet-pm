# Cabinet PM

Lightweight project management for cabinet manufacturing & installation.
Built as a working prototype for the eventual CabinetLogic Studio PM module.

**Stack:** Next.js 15 (App Router) · Supabase (Postgres + Auth + RLS) · Tailwind · shadcn/ui · TanStack Query

## What it does (MVP)

- **Year plan** — Gantt + Calendar toggle. Projects auto-scheduled backwards from estimated completion date using an 8-week default lead time (overridable per project).
- **Projects → Rooms → Tasks** — three-level structure. Each room moves through configurable phases.
- **Tasks** — job tasks (linked to project/room) and personal todos in the same table. Assignee + completed_by tracked.
- **Configurable phases** — define your own pipeline (e.g. Quote → Design → Production → Install → Sign-off), reorderable.

## Setup

### 1. Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. In SQL Editor, run the migrations in `supabase/migrations/` **in order**.
3. Go to Authentication → Providers, enable Email (magic link is easiest for 3 users).
4. Copy your project URL and anon key.

### 2. Local dev

```bash
pnpm install   # or npm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
pnpm dev
```

### 3. Seed your team

After your first login (which creates an auth user), run `supabase/seed.sql` in the SQL Editor — it inserts default phases and links your auth user to a profile. Edit it to add your other two team members' emails before running.

### 4. Deploy

```bash
vercel
```

Add the two `NEXT_PUBLIC_SUPABASE_*` env vars in the Vercel dashboard. That's it.

## Project structure

```
app/                    Next.js App Router pages
  dashboard/            "My day" — assigned tasks, active projects
  plan/                 Year view — Gantt + Calendar toggle
  projects/             Project list + detail (rooms, phases, tasks)
  tasks/                All tasks with filters
  settings/             Phases, team, lead time default
components/             React components (shadcn/ui in components/ui)
lib/supabase/           Browser + server Supabase clients
supabase/migrations/    SQL migrations — run in numbered order
docs/DECISIONS.md       Architectural decisions + lessons learned
```

## Notes

- All 3 team members can see everything. RLS enforces that only the assignee or creator can mark tasks complete.
- Backward scheduling: `start_date = estimated_completion_date - (lead_time_weeks * 7)`. Computed in SQL, exposed as a generated column.
- Keep `docs/DECISIONS.md` updated with friction points — those notes are the spec for the CabinetLogic version.
