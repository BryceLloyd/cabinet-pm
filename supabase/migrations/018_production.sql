-- Migration 017: Production management
-- A standalone factory pipeline built around cutlists. Adding a cutlist
-- auto-fills every section's queue at the right granularity. Stages, steps and
-- gates are configurable data (not tables) so new sections (e.g. a future
-- "Factory" stage) are added by inserting a row, never a migration.

-- ── 1. Config: suppliers ────────────────────────────────────────────────────
create table public.suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  int  not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ── 2. Config: production stages (the configurable sections) ────────────────
-- kind:             'work'  = checklist queue (Painting, Assembly, Installation)
--                   'order' = procurement list, To order → Ordered → Complete (Cut & edge, Hardware)
-- item_granularity: drives what production_items get generated per cutlist:
--   'material_order'          → one per material order            (Cut & edge)
--   'material_order_painting' → one per material order needs_painting (Painting)
--   'cutlist'                 → one per cutlist                   (Assembly, Hardware)
--   'room'                    → one per cutlist room             (Installation)
-- gates_on_stage_id: previous stage that must be fully complete for this
--   cutlist before items here unlock (null = no gate).
-- is_parallel: runs alongside the pipeline, never gated (Hardware orders).
create table public.production_stages (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  kind              text not null default 'work' check (kind in ('work', 'order')),
  item_granularity  text not null check (item_granularity in
                      ('material_order', 'material_order_painting', 'cutlist', 'room')),
  gates_on_stage_id uuid references public.production_stages(id) on delete set null,
  is_parallel       boolean not null default false,
  sort_order        int not null default 0,
  archived_at       timestamptz,
  created_at        timestamptz not null default now()
);

-- ── 3. Config: steps (mini-checklist template per stage) ────────────────────
create table public.production_steps (
  id          uuid primary key default gen_random_uuid(),
  stage_id    uuid not null references public.production_stages(id) on delete cascade,
  name        text not null,
  sort_order  int  not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);
create index production_steps_stage_idx on public.production_steps (stage_id);

-- ── 4. Cutlists (belong to a project) ───────────────────────────────────────
create table public.cutlists (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       text not null default '',
  due_date   date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cutlists_project_idx on public.cutlists (project_id);
create trigger cutlists_touch before update on public.cutlists
  for each row execute function public.touch_updated_at();

-- ── 5. Cutlist rooms (chosen subset of the project's existing rooms) ────────
create table public.cutlist_rooms (
  cutlist_id uuid not null references public.cutlists(id) on delete cascade,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  sort_order int  not null default 0,
  primary key (cutlist_id, room_id)
);
create index cutlist_rooms_room_idx on public.cutlist_rooms (room_id);

-- ── 6. Material orders (free-text name, supplier, needs_painting) ────────────
create table public.material_orders (
  id            uuid primary key default gen_random_uuid(),
  cutlist_id    uuid not null references public.cutlists(id) on delete cascade,
  material_name text not null,
  supplier_id   uuid references public.suppliers(id) on delete set null,
  needs_painting boolean not null default false,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index material_orders_cutlist_idx on public.material_orders (cutlist_id);

-- ── 7. Production items (generated queue rows) ──────────────────────────────
-- ref_id is polymorphic (material_orders | cutlists | rooms) so it has no FK;
-- cutlist_id always set and cascades, keeping rows clean on cutlist delete.
-- notes: free-text items list, used by Hardware orders (e.g. "hinges ×24").
-- completed_at/by are a rollup of the item's steps (see recompute trigger).
create table public.production_items (
  id           uuid primary key default gen_random_uuid(),
  stage_id     uuid not null references public.production_stages(id) on delete cascade,
  cutlist_id   uuid not null references public.cutlists(id) on delete cascade,
  ref_type     text not null check (ref_type in ('material_order', 'cutlist', 'room')),
  ref_id       uuid not null,
  notes        text,
  sort_order   int  not null default 0,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (stage_id, ref_type, ref_id)
);
create index production_items_stage_idx   on public.production_items (stage_id);
create index production_items_cutlist_idx on public.production_items (cutlist_id);

-- ── 8. Production item steps (per-item step instances) ──────────────────────
create table public.production_item_steps (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.production_items(id) on delete cascade,
  step_id      uuid not null references public.production_steps(id) on delete cascade,
  sort_order   int  not null default 0,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  unique (item_id, step_id)
);
create index production_item_steps_item_idx on public.production_item_steps (item_id);

-- ── 9. RLS ──────────────────────────────────────────────────────────────────
-- Operational tables: full team access (small team, same as projects/rooms).
alter table public.cutlists enable row level security;
create policy "cutlists_all_authed" on public.cutlists
  for all to authenticated using (true) with check (true);

alter table public.cutlist_rooms enable row level security;
create policy "cutlist_rooms_all_authed" on public.cutlist_rooms
  for all to authenticated using (true) with check (true);

alter table public.material_orders enable row level security;
create policy "material_orders_all_authed" on public.material_orders
  for all to authenticated using (true) with check (true);

alter table public.production_items enable row level security;
create policy "production_items_all_authed" on public.production_items
  for all to authenticated using (true) with check (true);

alter table public.production_item_steps enable row level security;
create policy "production_item_steps_all_authed" on public.production_item_steps
  for all to authenticated using (true) with check (true);

-- Config tables: read for all, write for admins only.
alter table public.suppliers enable row level security;
create policy "suppliers_select" on public.suppliers
  for select to authenticated using (true);
create policy "suppliers_admin_write" on public.suppliers
  for all to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

alter table public.production_stages enable row level security;
create policy "production_stages_select" on public.production_stages
  for select to authenticated using (true);
create policy "production_stages_admin_write" on public.production_stages
  for all to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

alter table public.production_steps enable row level security;
create policy "production_steps_select" on public.production_steps
  for select to authenticated using (true);
create policy "production_steps_admin_write" on public.production_steps
  for all to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

-- ── 10. Seed config ─────────────────────────────────────────────────────────
insert into public.suppliers (name, sort_order) values
  ('WW', 0),
  ('Boardware', 1);

insert into public.production_stages (name, slug, kind, item_granularity, is_parallel, sort_order) values
  ('Cut & edge',      'cut-edge',        'order', 'material_order',          false, 0),
  ('Painting',        'painting',        'work',  'material_order_painting', false, 1),
  ('Assembly',        'assembly',        'work',  'cutlist',                 false, 2),
  ('Installation',    'installation',    'work',  'room',                    false, 3),
  ('Hardware orders', 'hardware-orders', 'order', 'cutlist',                 true,  4);

-- Wire the strict pipeline gates by slug.
update public.production_stages set gates_on_stage_id =
  (select id from public.production_stages where slug = 'cut-edge') where slug = 'painting';
update public.production_stages set gates_on_stage_id =
  (select id from public.production_stages where slug = 'painting') where slug = 'assembly';
update public.production_stages set gates_on_stage_id =
  (select id from public.production_stages where slug = 'assembly') where slug = 'installation';

insert into public.production_steps (stage_id, name, sort_order)
select s.id, v.name, v.ord
from public.production_stages s
join (values
  ('cut-edge',        'Ordered',   0),
  ('cut-edge',        'Complete',  1),
  ('painting',        'Complete',  0),
  ('assembly',        'Assembled', 0),
  ('assembly',        'Hardware',  1),
  ('assembly',        'Doors',     2),
  ('installation',    'Complete',  0),
  ('hardware-orders', 'Ordered',   0),
  ('hardware-orders', 'Completed', 1)
) as v(slug, name, ord) on v.slug = s.slug;

-- ── 11. Auto-generation RPC ─────────────────────────────────────────────────
-- Idempotent: fills (and prunes incomplete, stale) production_items + their
-- steps for a cutlist. SECURITY DEFINER so it can write the generated tables
-- regardless of the caller's RLS. Call after creating a cutlist or changing
-- its material orders / rooms.
create or replace function public.generate_production_items(p_cutlist_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
begin
  for s in
    select * from production_stages where archived_at is null order by sort_order
  loop
    if s.item_granularity in ('material_order', 'material_order_painting') then
      insert into production_items (stage_id, cutlist_id, ref_type, ref_id, sort_order)
      select s.id, p_cutlist_id, 'material_order', mo.id,
             coalesce((select max(sort_order) from production_items
                       where stage_id = s.id and cutlist_id = p_cutlist_id), -1)
             + row_number() over (order by mo.sort_order, mo.created_at)
      from material_orders mo
      where mo.cutlist_id = p_cutlist_id
        and (s.item_granularity = 'material_order' or mo.needs_painting)
      on conflict (stage_id, ref_type, ref_id) do nothing;

      delete from production_items pi
      where pi.stage_id = s.id and pi.cutlist_id = p_cutlist_id
        and pi.ref_type = 'material_order'
        and pi.completed_at is null
        and pi.ref_id not in (
          select mo.id from material_orders mo
          where mo.cutlist_id = p_cutlist_id
            and (s.item_granularity = 'material_order' or mo.needs_painting)
        );

    elsif s.item_granularity = 'cutlist' then
      insert into production_items (stage_id, cutlist_id, ref_type, ref_id, sort_order)
      values (s.id, p_cutlist_id, 'cutlist', p_cutlist_id, 0)
      on conflict (stage_id, ref_type, ref_id) do nothing;

    elsif s.item_granularity = 'room' then
      insert into production_items (stage_id, cutlist_id, ref_type, ref_id, sort_order)
      select s.id, p_cutlist_id, 'room', cr.room_id,
             coalesce((select max(sort_order) from production_items
                       where stage_id = s.id and cutlist_id = p_cutlist_id), -1)
             + row_number() over (order by cr.sort_order)
      from cutlist_rooms cr
      where cr.cutlist_id = p_cutlist_id
      on conflict (stage_id, ref_type, ref_id) do nothing;

      delete from production_items pi
      where pi.stage_id = s.id and pi.cutlist_id = p_cutlist_id
        and pi.ref_type = 'room'
        and pi.completed_at is null
        and pi.ref_id not in (
          select cr.room_id from cutlist_rooms cr where cr.cutlist_id = p_cutlist_id
        );
    end if;

    -- Fan out steps for every item of this stage+cutlist.
    insert into production_item_steps (item_id, step_id, sort_order)
    select pi.id, ps.id, ps.sort_order
    from production_items pi
    join production_steps ps on ps.stage_id = s.id and ps.archived_at is null
    where pi.stage_id = s.id and pi.cutlist_id = p_cutlist_id
    on conflict (item_id, step_id) do nothing;
  end loop;
end;
$$;

grant execute on function public.generate_production_items(uuid) to authenticated;

-- ── 12. Step-config sync RPC ────────────────────────────────────────────────
-- Re-fan steps across all existing items of a stage after its step config
-- changes; remove incomplete instances of archived steps.
create or replace function public.sync_stage_steps(p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into production_item_steps (item_id, step_id, sort_order)
  select pi.id, ps.id, ps.sort_order
  from production_items pi
  join production_steps ps on ps.stage_id = pi.stage_id and ps.archived_at is null
  where pi.stage_id = p_stage_id
  on conflict (item_id, step_id) do nothing;

  delete from production_item_steps pis
  using production_steps ps
  where pis.step_id = ps.id
    and ps.stage_id = p_stage_id
    and ps.archived_at is not null
    and pis.completed_at is null;
end;
$$;

grant execute on function public.sync_stage_steps(uuid) to authenticated;

-- ── 13. Completion rollup trigger ───────────────────────────────────────────
-- Keep production_items.completed_at authoritative: an item is complete when
-- every one of its step instances is ticked. SECURITY DEFINER so it can write
-- production_items from a step change.
create or replace function public.recompute_item_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_total int;
  v_done int;
begin
  v_item_id := coalesce(new.item_id, old.item_id);

  select count(*), count(completed_at) into v_total, v_done
  from production_item_steps where item_id = v_item_id;

  if v_total > 0 and v_done = v_total then
    update production_items
      set completed_at = now(), completed_by = auth.uid()
      where id = v_item_id and completed_at is null;
  else
    update production_items
      set completed_at = null, completed_by = null
      where id = v_item_id and completed_at is not null;
  end if;

  return null;
end;
$$;

create trigger trg_recompute_item_completion
  after insert or update or delete on public.production_item_steps
  for each row execute function public.recompute_item_completion();
