# User Permissions — Step 2: Database Lock-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the role capabilities real at the database level — Factory/Site can only *read* and *complete*, Office/Admin manage operations, Admin-only manages system settings/team — so it holds regardless of the UI.

**Architecture:** Three SECURITY DEFINER helper functions (`auth_role`, `is_admin`, `is_office`) back rewritten RLS policies across all operational + settings tables. Reads stay open to authenticated users; writes are gated per the capability matrix. The one transition-level rule ("Factory may mark a hardware order *received* but not *place* it") is enforced by a SECURITY DEFINER RPC; the app calls it instead of a direct status update. `production_item_steps` completion stays a direct update (open to all roles).

**Tech Stack:** Supabase Postgres + RLS, `@supabase/ssr`, Next.js client components.

## ⛔ HARD DEPENDENCY — read first
This plan's RLS checks `role in ('admin','office')`. It is **only safe once Step 1 is live** (migration 027 has run, so `member` users are `office`). Applying this to the shared DB **before** Step 1 deploys would lock `josh`/`shandon` (still `member`) out of writing. **Sequence: merge #8 → merge #9 → apply migration 027 → deploy → only then apply this plan's migrations.** RLS cannot be unit-tested without a database (no local Docker here), so verification happens against the live DB *after* Step 1 lands, using throwaway per-role users.

**Branch:** `claude/user-permissions-db`, stacked on `claude/user-permissions` (PR #9).

---

### Task 1: Helper functions + office-domain RLS (deploy-safe value win)

**Files:**
- Create: `supabase/migrations/028_rls_helpers_and_office_domain.sql`

These tables are never written by Factory/Site in the UI, so locking them to Office+Admin changes nothing for those roles — it just makes it real.

- [ ] **Step 1: Write the migration**

```sql
-- Migration 028: RLS helpers + office-domain write lock-down.

-- Helper functions (SECURITY DEFINER so they can read profiles under RLS).
create or replace function public.auth_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() = 'admin', false);
$$;

create or replace function public.is_office()  -- admin OR office
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() in ('admin', 'office'), false);
$$;

-- Office-domain tables: read = all authenticated; write = admin/office.
-- Replaces the broad "*_all_authed" / "Authenticated users can manage" policies.
do $$
declare t text;
begin
  foreach t in array array[
    'projects','rooms','room_groups','phase_plans','room_phase_history',
    'tasks','task_checklist_items','calendar_events',
    'cutlists','cutlist_rooms','material_orders','cutlist_hardware_items',
    'production_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- Drop any existing permissive policies on the table.
    execute format($q$
      do $inner$
      declare p record;
      begin
        for p in select policyname from pg_policies where schemaname='public' and tablename=%L loop
          execute format('drop policy if exists %%I on public.%I', p.policyname, %L);
        end loop;
      end $inner$;
    $q$, t, t, t);
    execute format('create policy "%1$s_select" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "%1$s_modify" on public.%1$I for all to authenticated using (public.is_office()) with check (public.is_office())', t);
  end loop;
end $$;
```

- [ ] **Step 2: Commit (do NOT push to live DB yet — see HARD DEPENDENCY)**

```bash
git add supabase/migrations/028_rls_helpers_and_office_domain.sql
git commit -m "feat(db): RLS helpers + office-domain write lock-down (office/admin)"
```

---

### Task 2: Settings RLS (admin-only vs office+admin)

**Files:**
- Create: `supabase/migrations/029_rls_settings.sql`

System settings = Admin only. Production settings = Office + Admin (per the design). Some are already admin-gated; this normalizes them and closes the open INSERT holes on `materials` / `hardware_catalog`.

- [ ] **Step 1: Write the migration**

```sql
-- Migration 029: settings table RLS.

-- System settings: read = all; write = admin only.
do $$
declare t text;
begin
  foreach t in array array['phases','task_types','event_types','task_templates','business_info'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($q$
      do $inner$
      declare p record;
      begin
        for p in select policyname from pg_policies where schemaname='public' and tablename=%L loop
          execute format('drop policy if exists %%I on public.%I', p.policyname, %L);
        end loop;
      end $inner$;
    $q$, t, t, t);
    execute format('create policy "%1$s_select" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "%1$s_modify" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- business_info is also read pre-login (login page). Keep public read.
drop policy if exists "business_info_select" on public.business_info;
create policy "business_info_select" on public.business_info for select using (true);

-- Production settings: read = all; write = office/admin.
do $$
declare t text;
begin
  foreach t in array array['materials','hardware_catalog','paint_types','suppliers','production_stages','production_steps'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($q$
      do $inner$
      declare p record;
      begin
        for p in select policyname from pg_policies where schemaname='public' and tablename=%L loop
          execute format('drop policy if exists %%I on public.%I', p.policyname, %L);
        end loop;
      end $inner$;
    $q$, t, t, t);
    execute format('create policy "%1$s_select" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "%1$s_modify" on public.%1$I for all to authenticated using (public.is_office()) with check (public.is_office())', t);
  end loop;
end $$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/029_rls_settings.sql
git commit -m "feat(db): settings RLS - system=admin, production=office"
```

---

### Task 3: Production completion — item steps RLS + hardware status RPC

**Files:**
- Create: `supabase/migrations/030_production_completion.sql`
- Modify: `components/production/hardware-orders.tsx:41` (use RPC)

`production_item_steps`: completion is a toggle (`completed_at`/`completed_by`) — allow UPDATE to all roles; INSERT/DELETE office/admin (steps are generated by `generate_production_items`). `hardware_orders`/`hardware_order_items`: create/place = office/admin; Factory marks *received* via RPC only.

- [ ] **Step 1: Write the migration**

```sql
-- Migration 030: production completion rules.

-- production_item_steps: read all; UPDATE any role (sign-off); INSERT/DELETE office.
alter table public.production_item_steps enable row level security;
do $inner$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='production_item_steps' loop
    execute format('drop policy if exists %I on public.production_item_steps', p.policyname);
  end loop;
end $inner$;
create policy "pis_select" on public.production_item_steps for select to authenticated using (true);
create policy "pis_update" on public.production_item_steps for update to authenticated using (true) with check (true);
create policy "pis_insert" on public.production_item_steps for insert to authenticated with check (public.is_office());
create policy "pis_delete" on public.production_item_steps for delete to authenticated using (public.is_office());

-- hardware_orders + hardware_order_items: read all; write office/admin only.
-- (Factory completion of hardware goes through the RPC below, not direct writes.)
do $$
declare t text;
begin
  foreach t in array array['hardware_orders','hardware_order_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($q$
      do $inner$
      declare p record;
      begin
        for p in select policyname from pg_policies where schemaname='public' and tablename=%L loop
          execute format('drop policy if exists %%I on public.%I', p.policyname, %L);
        end loop;
      end $inner$;
    $q$, t, t, t);
    execute format('create policy "%1$s_select" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "%1$s_modify" on public.%1$I for all to authenticated using (public.is_office()) with check (public.is_office())', t);
  end loop;
end $$;

-- RPC: set hardware item status with role-aware transition rules.
-- admin/office: any status. factory: only 'received'. site: denied.
create or replace function public.set_hardware_items_status(p_item_ids uuid[], p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare r text := public.auth_role();
begin
  if r is null then raise exception 'Not authenticated'; end if;
  if p_status not in ('to_order','ordered','received') then
    raise exception 'Invalid status %', p_status;
  end if;
  if r in ('admin','office') then
    null; -- any transition allowed
  elsif r = 'factory' then
    if p_status <> 'received' then
      raise exception 'Factory may only mark items received';
    end if;
  else
    raise exception 'Not allowed';
  end if;

  update public.hardware_order_items
     set status = p_status,
         ordered_at  = case when p_status = 'to_order' then null
                            when p_status in ('ordered','received') then coalesce(ordered_at, now())
                            else ordered_at end,
         received_at = case when p_status = 'received' then now() else null end,
         completed_by = case when p_status = 'received' then auth.uid() else null end
   where id = any(p_item_ids);
end $$;

grant execute on function public.set_hardware_items_status(uuid[], text) to authenticated;
```

- [ ] **Step 2: Update `components/production/hardware-orders.tsx`**

Replace the direct status `.update()` (around line 41) with the RPC. Current code shape:

```ts
await supabase.from("hardware_order_items").update({ status, ordered_at, received_at, completed_by }).in("id", batch.itemIds);
```

becomes:

```ts
const { error } = await supabase.rpc("set_hardware_items_status", {
  p_item_ids: batch.itemIds,
  p_status: status,
});
```

(Remove the now-unneeded local `ordered_at` / `received_at` / `completed_by` computation — the RPC sets them. Keep the optimistic UI update.)

- [ ] **Step 3: Hide place-order controls from Factory/Site in the UI**

In `components/production/hardware-orders.tsx`, pass the current role in (the page already loads the profile) and render the "Order" / "Mark ordered" transition control + "Add hardware order" only when `is_office`. Factory keeps the "Mark received" control. (Site does not reach the hardware section.) Type check after.

- [ ] **Step 4: Type check + commit**

Run: `npx tsc --noEmit` → PASS

```bash
git add supabase/migrations/030_production_completion.sql components/production/hardware-orders.tsx
git commit -m "feat(production): item-step RLS + hardware status RPC (factory completes, office places)"
```

---

### Task 4: Drop the dead toggle columns (post-deploy cleanup)

**Files:**
- Create: `supabase/migrations/031_drop_view_access_columns.sql`

Safe now: by the time these migrations apply, Step 1 is deployed and no code reads these columns.

- [ ] **Step 1: Write the migration**

```sql
-- Migration 031: drop the now-unused view-access columns (Step 1 left them).
alter table public.profiles drop column if exists office_access;
alter table public.profiles drop column if exists production_access;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/031_drop_view_access_columns.sql
git commit -m "chore(db): drop dead office_access/production_access columns"
```

---

### Task 5: Apply + verify (AFTER Step 1 is live)

- [ ] **Step 1: Apply migrations** — `supabase db push` (applies 028–031). Verify helpers exist and policies are in place:
  `supabase db query "select tablename, policyname from pg_policies where schemaname='public' order by tablename" --linked`

- [ ] **Step 2: Per-role verification** — create throwaway admin/office/factory/site users (admin API), then via the preview confirm each allowed/denied write:
  - **Office:** can edit a project, place a hardware order, edit a material — all succeed.
  - **Factory:** editing a project is **denied** (RLS error); marking a hardware batch **received** succeeds via RPC; trying to set a batch to **ordered** is **denied**; completing an item step succeeds.
  - **Site:** completing an installation item step succeeds; project/settings writes denied.
  - **Admin:** everything succeeds.
  Confirm denials surface as handled errors in the UI (not crashes); add friendly error toasts where a denial is now reachable.

- [ ] **Step 3: Clean up** temp users; stop preview.

- [ ] **Step 4: Push branch + open PR** (base: `claude/user-permissions`).

---

## Deployment coordination (recap)
1. Merge #8, #9. 2. Apply migration 027, deploy (Step 1 live). 3. Apply 028–031 (`supabase db push`). 4. Deploy this PR's app changes (hardware RPC call). Because 030's RLS routes Factory hardware completion through the RPC, the app change (Task 3 Step 2) and migration 030 must go live together.

## Self-Review
- **Spec coverage:** office-domain writes → Task 1; settings split → Task 2; item-step completion + hardware place-vs-complete → Task 3; column drop → Task 4; per-role verify → Task 5. ✓
- **Placeholder scan:** SQL is concrete; the one app edit references the exact file/line and shows before/after. ✓
- **Type consistency:** RPC name `set_hardware_items_status(uuid[], text)` matches the client `.rpc("set_hardware_items_status", { p_item_ids, p_status })`. Helper names `auth_role/is_admin/is_office` used consistently. ✓
- **Risk:** RLS depends on Step 1's `member→office` migration — enforced by the HARD DEPENDENCY sequencing. `notifications`/`push_subscriptions`/`profiles` policies are intentionally untouched (own-row / service-role).
