# User Permissions Overhaul — Design

**Date:** 2026-06-24
**Status:** Approved design, pre-implementation
**Branch base:** stacked on `claude/admin-create-users` (PR #8) — merges after it

## Goals

1. **Simplify the role model.** Remove the overlapping `office_access` / `production_access` toggles and the legacy `member` role. Role alone decides what a person sees and can do.
2. **Lock down writes.** Enforce who-can-change-what at the **database** (RLS), not just by hiding buttons. Today most tables allow any logged-in user to edit/delete almost anything.

## Role model — four roles, role decides everything

| Role | Office view | Production view | Production settings | System settings | Team |
|------|:-:|:-:|:-:|:-:|:-:|
| **Admin** | ✅ full | ✅ full | ✅ | ✅ | ✅ |
| **Office** | ✅ full | ✅ full | ✅ | ❌ | ❌ |
| **Factory** | ❌ | ✅ cut-edge / painting / assembly / hardware | ❌ | ❌ | ❌ |
| **Site** | ❌ | ✅ installation only | ❌ | ❌ | ❌ |

- **Factory and Site never see the Office view** (dashboard, projects, tasks, calendar, quotes).
- **Production settings** = materials, suppliers, hardware catalog, paint types (and production stage/step config). Office + Admin.
- **System settings** = business info, phases, task types, event types, task templates. Admin only.
- **Team / users** = Admin only (already enforced via PR #8's create-user route).

**Removed:** `profiles.office_access`, `profiles.production_access` columns; the `member` role.
**Migration of existing users:** `member` → `office` (josh, shandon). Admin and Factory unchanged.

## Capability matrix — who can write what

Read access stays open to all authenticated users (Factory must see the job to build it). Writes:

| Resource | Create / Edit / Delete | Complete (mark received / sign off) |
|----------|:----:|:----:|
| Projects, rooms, scheduling, tasks, calendar, quotes | Admin + Office | — |
| Cutlists, cutlist rooms | Admin + Office | — |
| **Placing** orders (material / cut-edge, hardware) — set to `ordered` | Admin + Office | — |
| Orders → mark `received` | (place: Admin + Office) | **+ Factory** |
| Production items | Admin + Office | — |
| Production item steps (cut/paint/assembly/install sign-offs) | Admin + Office | **+ Factory + Site** |
| Production settings (materials, suppliers, hardware_catalog, paint_types, production_stages/steps) | Admin + Office | — |
| System settings (business_info, phases, task_types, event_types, task_templates) | Admin only | — |
| Team / users, allowed_emails | Admin only | — |
| Notifications, push_subscriptions, notes, profile (own) | owner (unchanged) | — |

**Order lifecycle:** `to_order → ordered → received`. Factory/Site can push *forward to done* (mark received / sign off) but cannot **place / initiate** an order (set `ordered`). Placing stays Admin + Office.

## Enforcement

**App layer (visibility / UX):**
- `lib/production/access.ts`: drop `member`; add `canSeeOffice(role)` = admin|office, `canSeeProduction(role)` = all, `canSeeProductionSettings(role)` = admin|office.
- `middleware.ts` + `app/(app)/layout.tsx`: derive Office/Production view access from role instead of the dropped columns.
- UI hides/disables actions a role can't perform (e.g. Factory sees no "Place order" / edit / delete buttons).

**Database layer (the real boundary — source of truth):**
- Helper SQL functions (SECURITY DEFINER): `auth_role()`, `is_admin()`, `is_office_or_admin()`.
- Per-table RLS policies rewritten per the matrix. Replaces the broad `*_all_authed` / "Authenticated users can manage" policies.
- **Status transitions** ("complete but not initiate") can't be expressed cleanly by row policies — they're about *which* status change and *which* columns. These go through small **SECURITY DEFINER RPCs** (e.g. `complete_order(order_id)`, `complete_item_step(step_id)`) that validate the caller's role + the allowed transition. Direct writes to those status tables stay Admin + Office; Factory/Site complete via the RPCs.
- Service-role routes (push send, cron notifications, create-user) bypass RLS and are unaffected.

## Two-step delivery

### Step 1 — App-layer role cleanup (first PR)
- Migration: `member → office`; role check constraint → `('admin','office','factory','site')`; drop `office_access` / `production_access` columns.
- `access.ts`, `middleware.ts`, `layout.tsx`: role-derived view access.
- `team-list.tsx`, `create-user-form.tsx`, `/api/users/create`: remove access checkboxes, role-only dropdown (no `member`), short per-role legend.
- **Outcome:** clear roles + correct view gating. Database is still permissive until Step 2.

### Step 2 — Database lock-down (second PR)
- Helper functions + RLS rewrite across: projects, rooms, room_groups, phase_plans, room_phase_history, tasks, task_checklist_items, calendar_events, event_types, task_types, task_templates, cutlists, cutlist_rooms, material_orders, cutlist_hardware_items, production_items, production_item_steps, hardware_orders, hardware_order_items, materials, hardware_catalog, paint_types, suppliers, production_stages, production_steps, phases, business_info.
- Status-transition RPCs; app routes Factory/Site "complete" actions through them.
- **Testing:** create one test user per role; verify each role's allowed actions succeed and forbidden actions are denied (both UI and direct API), then clean up.

## Risks & notes
- **RLS misconfiguration can 403 legitimate users.** Test every role's happy path before merging Step 2.
- Stacked on PR #8; merges after it.
- Coarse production-step RLS (any of admin/office/factory/site may write item steps) — per-section restriction stays app-layer only. Acceptable: forbidden sections aren't reachable in the UI.

## Out of scope (YAGNI)
- Per-person / per-feature granular capabilities (rejected in favour of role-based).
- Per-section database enforcement for production steps.
