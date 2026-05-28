# Task & Event Slide Panels + Events List View

**Date:** 2026-05-28
**Status:** Approved
**Scope:** 3 features — task detail panel, event detail panel, events list view

---

## Overview

Enhance the factory management app with richer task and event interactions via slide-out panels, and add a dedicated events list view under the year plan. All changes are intentionally simple — fields can be expanded later.

## Feature 1: Shared SlidePanel Component

A single reusable slide-out panel component used by both tasks and events.

### Desktop behavior
- Slides in from the right edge of the viewport
- Width: ~380px, full viewport height
- Dimmed backdrop behind (semi-transparent black overlay)
- Box shadow on the left edge for depth

### Mobile behavior
- Slides up from the bottom as a bottom sheet
- Max height: 75% of viewport
- Drag handle at top (small rounded bar) — swipe down to dismiss
- Rounded top corners (16px radius)
- Scrollable body if content overflows

### Shared behavior
- **Close triggers:** Click ✕ button, click backdrop, press Escape key, swipe down (mobile)
- **Header:** Title text ("Task Detail" or "Event Detail"), trash icon (red), close ✕ button
- **Delete:** Trash icon opens a confirm dialog before deleting
- **Auto-save:** All field changes save automatically (800ms debounce, matching existing app pattern), no explicit save button
- **Animation:** Slide transition (~200ms ease-out)
- **Single panel:** Only one slide panel open at a time across the entire app — opening a new one closes the current one
- **Delete confirm:** Browser `confirm()` dialog (simple, consistent with existing delete patterns in the app)

### Component API
- `open: boolean` — controls visibility
- `onClose: () => void` — called on any close trigger
- `title: string` — header text
- `onDelete?: () => void` — if provided, shows trash icon in header
- `children` — panel body content (form fields specific to task or event)

### Responsive breakpoint
- Desktop (md: 768px+): slides from right
- Mobile (<768px): bottom sheet

---

## Feature 2: Task Detail Panel

Clicking a task (row on desktop, card on mobile) opens the SlidePanel with task-specific fields.

### Fields (all editable)
1. **Checkbox + Title** — checkbox toggles complete/incomplete. Title is inline-editable (click to focus, renders as text by default with a transparent border that becomes visible on hover/focus).
2. **Due date** — date picker field. Shows formatted date (e.g., "Fri, May 30 2026"). Calendar icon prefix.
3. **Assigned to** — dropdown select. Shows avatar initial circle + name. Lists all active users.
4. **Notes** — textarea for free-form notes. Placeholder text when empty ("Add notes..."). Maps to the existing `description` field in the tasks table.

### Footer
- Meta line at bottom: "Created [date] · [project code]" in muted small text
- Separated from fields by a subtle top border

### Interactions
- Click any task in the list → panel opens with that task's data
- Edit any field → auto-saves after debounce
- Toggle checkbox → updates completed_at/completed_by, keeps panel open
- Delete → confirm dialog → removes task, closes panel
- Clicking another task while panel is open swaps content (no close/reopen)

### Data mapping
- Title → `tasks.title`
- Notes → `tasks.description` (existing field, currently unused in UI)
- Due date → `tasks.due_date`
- Assignee → `tasks.assigned_to`
- Complete → `tasks.completed_at` + `tasks.completed_by`

---

## Feature 3: Event Detail Panel

Clicking an event on the calendar (month grid or events list) opens the SlidePanel with event-specific fields.

### Fields (all editable)
1. **Color dot + Title** — small circle in event type color, followed by inline-editable title. No checkbox (events aren't completable).
2. **Date** — date picker field. Shows formatted date. Calendar icon prefix.
3. **Event type** — dropdown select. Shows color swatch circle + type name. Lists all non-archived event types.
4. **Project** — dropdown select. Optional (can be "None"). Lists all active projects.
5. **Room group** — dropdown select. Conditional — only shown when a project is selected. Lists room groups for the selected project.
6. **Notes** — textarea for free-form notes. Placeholder "Add notes..." when empty.

### Footer
- Meta line: "Created [date]" in muted small text

### Interactions
- Click any event on the calendar grid → panel opens
- Click any event card on the events list view → panel opens
- Edit any field → auto-saves after debounce
- Changing project clears room group selection
- Delete → confirm dialog → removes event, closes panel
- Panel closes, calendar/list view refreshes to reflect changes

### Data mapping
- Title → `calendar_events.title`
- Date → `calendar_events.event_date`
- Event type → `calendar_events.event_type_id`
- Project → `calendar_events.project_id`
- Room group → `calendar_events.room_group_id`
- Notes → `calendar_events.notes`

---

## Feature 4: Events List View (Year Plan)

A new third view toggle under the year plan, alongside Gantt and Calendar.

### View toggle
- Existing: `Gantt | Calendar`
- New: `Gantt | Calendar | Events`
- Active view highlighted (dark background, white text)

### Layout
- Events grouped by month in chronological order
- Month headers: uppercase, small, bold, muted color, with subtle bottom border
- Each event rendered as a card (border, rounded corners, hover highlight)

### Event card contents
- **Left:** Event type color dot (10px circle)
- **Center:** Title (14px, medium weight) + project/room code below (12px, muted)
- **Right:** Day + weekday (e.g., "Wed 28") + event type badge (small pill with tinted background matching event type color)

### Behavior
- **Year navigation:** Same ‹ 2026 › arrows as Gantt/Calendar views
- **Click a card:** Opens event slide panel (Feature 3)
- **Auto-scroll:** On initial load, scrolls to the current month
- **Empty months:** Skipped entirely — no placeholder sections
- **Mobile:** Same card layout — already single-column, works as-is
- **Data source:** Same `calendar_events` query used by the calendar view, sorted by `event_date` ascending

---

## What's NOT in scope

- 2-week calendar view (deferred — user wants to think about this more)
- Task priority display or editing
- Task deletion from the list view (only from within the panel)
- Recurring events
- Drag-to-reschedule
- Event time (events are date-only)
- Any new database fields or migrations — all fields already exist

---

## Architecture

### New components
1. **SlidePanel** — shared wrapper component (animation, backdrop, header, responsive direction)
2. **TaskDetailPanel** — task-specific form content, rendered inside SlidePanel
3. **EventDetailPanel** — event-specific form content, rendered inside SlidePanel
4. **EventsListView** — new year plan view with month-grouped event cards

### Integration points
- Task list (desktop table + mobile cards): add onClick handler → open TaskDetailPanel
- Calendar month grid: add onClick handler on event chips → open EventDetailPanel
- Year plan view toggles: add "Events" option → render EventsListView
- EventsListView cards: onClick → open EventDetailPanel

### State management
- Panel open/close state managed locally (useState in parent component)
- Selected task/event ID passed to panel, panel fetches/displays data
- Auto-save via existing Supabase update patterns (debounced)
- On save, optimistically update local state and refresh list

### Styling
- Follow existing design system: border colors, radius, font sizes, spacing
- Consistent with existing modal/card patterns in the codebase
- Backdrop: `fixed inset-0 z-50 bg-black/40`
- Panel: `bg-card border shadow-lg`
