-- Migration 020: Factory lists + production reshape
-- - Suppliers gain an in-house / outsource kind.
-- - Managed lists: materials, paint_types, hardware_catalog.
-- - Material orders carry a paint_type (replaces needs_painting boolean).
-- - Per-cutlist hardware order items.
-- - Cut & edge steps differ by supplier kind (in-house = Complete; outsource = Ordered → Received).
-- - Strict gating removed (all section items are independent).

-- ── 1. Supplier kind ─────────────────────────────────────────────────────────
alter table public.suppliers add column kind text not null default 'outsource'
  check (kind in ('in_house', 'outsource'));
update public.suppliers set kind = 'in_house' where name = 'WW';

-- ── 2. Materials catalog ─────────────────────────────────────────────────────
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
insert into public.materials (name, sort_order) values
  ('Oak Veneer', 0), ('White Mel', 1), ('Storm Grey', 2), ('MS + MDF', 3),
  ('32mm MDF', 4), ('Luca Polenta', 5), ('MS', 6), ('MS Shaker + MDF', 7);

-- ── 3. Paint types ───────────────────────────────────────────────────────────
create table public.paint_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
insert into public.paint_types (name, sort_order) values ('Duco', 0), ('Lacquer', 1);

-- ── 4. Hardware catalog ──────────────────────────────────────────────────────
create table public.hardware_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
insert into public.hardware_catalog (name, sort_order) values
  ('Soft-close hinge', 0), ('Drawer runner 400mm', 1), ('Drawer runner 500mm', 2), ('Shelf pin', 3);

-- ── 5. Per-cutlist hardware order items ──────────────────────────────────────
create table public.cutlist_hardware_items (
  id uuid primary key default gen_random_uuid(),
  cutlist_id uuid not null references public.cutlists(id) on delete cascade,
  name text not null,
  qty int,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index cutlist_hardware_items_cutlist_idx on public.cutlist_hardware_items (cutlist_id);

-- ── 6. Paint type on material orders (replaces needs_painting) ───────────────
alter table public.material_orders
  add column paint_type_id uuid references public.paint_types(id) on delete set null;

-- ── 7. RLS ───────────────────────────────────────────────────────────────────
-- materials & hardware_catalog: read all, INSERT by any authed (custom entries
-- auto-save), update/delete admin-only.
alter table public.materials enable row level security;
create policy "materials_select" on public.materials for select to authenticated using (true);
create policy "materials_insert" on public.materials for insert to authenticated with check (true);
create policy "materials_admin_update" on public.materials for update to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin');
create policy "materials_admin_delete" on public.materials for delete to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

alter table public.hardware_catalog enable row level security;
create policy "hardware_catalog_select" on public.hardware_catalog for select to authenticated using (true);
create policy "hardware_catalog_insert" on public.hardware_catalog for insert to authenticated with check (true);
create policy "hardware_catalog_admin_update" on public.hardware_catalog for update to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin');
create policy "hardware_catalog_admin_delete" on public.hardware_catalog for delete to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- paint_types: read all, admin write only (selected from a dropdown, not custom).
alter table public.paint_types enable row level security;
create policy "paint_types_select" on public.paint_types for select to authenticated using (true);
create policy "paint_types_admin_write" on public.paint_types for all to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

-- cutlist_hardware_items: operational (full team access).
alter table public.cutlist_hardware_items enable row level security;
create policy "cutlist_hardware_items_all_authed" on public.cutlist_hardware_items
  for all to authenticated using (true) with check (true);

-- ── 8. Per-supplier-kind steps for Cut & edge ────────────────────────────────
alter table public.production_steps add column applies_to text not null default 'all'
  check (applies_to in ('all', 'in_house', 'outsource'));

-- Replace Cut & edge steps: in-house = [Complete]; outsource = [Ordered, Received].
delete from public.production_steps
  where stage_id = (select id from public.production_stages where slug = 'cut-edge');
insert into public.production_steps (stage_id, name, sort_order, applies_to)
select s.id, v.name, v.ord, v.kind
from public.production_stages s
join (values
  ('Complete', 0, 'in_house'),
  ('Ordered',  0, 'outsource'),
  ('Received', 1, 'outsource')
) as v(name, ord, kind) on true
where s.slug = 'cut-edge';

-- ── 9. Remove strict gating (all sections independent) ───────────────────────
update public.production_stages set gates_on_stage_id = null;

-- ── 10. Regenerate RPC: paint via paint_type_id; per-kind step fan-out ───────
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
        and (s.item_granularity = 'material_order' or mo.paint_type_id is not null)
      on conflict (stage_id, ref_type, ref_id) do nothing;

      delete from production_items pi
      where pi.stage_id = s.id and pi.cutlist_id = p_cutlist_id
        and pi.ref_type = 'material_order'
        and pi.completed_at is null
        and pi.ref_id not in (
          select mo.id from material_orders mo
          where mo.cutlist_id = p_cutlist_id
            and (s.item_granularity = 'material_order' or mo.paint_type_id is not null)
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

    -- Fan out steps. Cut & edge steps are filtered by supplier kind via applies_to.
    insert into production_item_steps (item_id, step_id, sort_order)
    select pi.id, ps.id, ps.sort_order
    from production_items pi
    join production_steps ps on ps.stage_id = s.id and ps.archived_at is null
    left join material_orders mo on pi.ref_type = 'material_order' and mo.id = pi.ref_id
    left join suppliers sup on sup.id = mo.supplier_id
    where pi.stage_id = s.id and pi.cutlist_id = p_cutlist_id
      and (ps.applies_to = 'all' or ps.applies_to = coalesce(sup.kind, 'in_house'))
    on conflict (item_id, step_id) do nothing;
  end loop;
end;
$$;

-- ── 11. sync_stage_steps with applies_to filter ─────────────────────────────
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
  left join material_orders mo on pi.ref_type = 'material_order' and mo.id = pi.ref_id
  left join suppliers sup on sup.id = mo.supplier_id
  where pi.stage_id = p_stage_id
    and (ps.applies_to = 'all' or ps.applies_to = coalesce(sup.kind, 'in_house'))
  on conflict (item_id, step_id) do nothing;

  delete from production_item_steps pis
  using production_steps ps
  where pis.step_id = ps.id
    and ps.stage_id = p_stage_id
    and ps.archived_at is not null
    and pis.completed_at is null;
end;
$$;

-- ── 12. Drop needs_painting (now derived from paint_type_id) ─────────────────
alter table public.material_orders drop column needs_painting;
