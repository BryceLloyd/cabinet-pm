# Architectural Decisions & Lessons Learned

This file is the spec for the eventual CabinetLogic Studio PM module.
Keep it updated as you use the app and discover what works / doesn't.

---

## Core decisions

### Backward scheduling via generated column
`projects.start_date` is a Postgres generated column:
`estimated_completion_date - (lead_time_weeks * 7)`. This means the start
date is always consistent, never drifts, and can be filtered/sorted on the DB
side. Override per-project by changing `lead_time_weeks`.

**Question to revisit:** do we need per-phase lead times rather than a single
project-level lead time? (e.g. Production = 4 weeks, Install = 1 week, etc.)
For now: no. Total lead time is what matters for high-level planning.

### Phases are data, not enums
Configurable in `phases` table with sort_order. Lets us iterate on the pipeline
without migrations. Trade-off: slightly slower queries (need joins to get
phase name/color), but for a 3-person team this is invisible.

### Single tasks table for job + personal todos
`tasks.project_id` and `tasks.room_id` are both nullable. If both null →
personal todo, only visible to creator. Enforced via RLS + a CHECK constraint
that personal todos must be self-assigned.

**Why one table:** users want a single "my tasks today" view that mixes both.
Separate tables would mean UNION queries everywhere.

### Phase history is automatic
Trigger on `rooms.current_phase_id` writes to `room_phase_history`. Gives us
"how long was this room in production?" for free, once we want to report on it.

### RLS: trust the team
All 3 users can read/write everything in projects/rooms. Only constraint:
task completion is restricted to assignee or creator. Personal todos are
private to creator. This matches how a 3-person team actually works — no need
for fine-grained permissions yet.

---

## What's deliberately NOT built (yet)

- **Drag-to-reschedule on the Gantt.** Click-to-edit is fine for v1. Build
  drag when we actually find ourselves wanting it.
- **Notifications / email reminders.** We see each other every day.
- **File attachments.** Use Drive/Dropbox until proven friction.
- **Hardware / cut list integration.** This is a planning tool. CabinetLogic
  handles parts.
- **Multi-workspace.** One workspace = one team. Don't add complexity.
- **Phase editing UI.** Edit phases directly in Supabase for now. Build the UI
  once we know how often we actually change them.

---

## Friction log

Add notes here as you use the app. Format:

```
[YYYY-MM-DD] What hurt / what's missing / what surprised you
```

[2026-MM-DD] (example) — Adding 10 tasks to a new project takes too many
clicks. Want a "paste a list, one per line" import.

---

## Porting notes for CabinetLogic

When you bring this into CabinetLogic Studio:

1. **Replace `projects` creation with quote acceptance.** When a quote is
   accepted in CabinetLogic, auto-create a project with completion date pulled
   from the quote's agreed delivery date.
2. **Rooms map to CabinetLogic rooms.** They already exist there with parts
   lists — link via `cabinetlogic_room_id`.
3. **Phase model stays as-is.** This is the genuinely useful abstraction.
4. **Task system stays as-is.** Generic enough to work in either context.
5. **Drop the simple SVG Gantt** for whatever charting CabinetLogic already
   uses, if anything.
