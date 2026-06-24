-- Migration 021: per-cutlist uniqueness for production_items
-- A room or material ref can legitimately appear in more than one cutlist's
-- queue (e.g. two cutlists covering the same room). The old unique constraint
-- (stage_id, ref_type, ref_id) omitted cutlist_id, so a shared room id collided
-- across cutlists and the generate RPC silently skipped its installation items.
-- Uniqueness must be scoped per cutlist.

alter table public.production_items
  drop constraint production_items_stage_id_ref_type_ref_id_key;
alter table public.production_items
  add constraint production_items_per_cutlist_key
  unique (cutlist_id, stage_id, ref_type, ref_id);

-- Regenerate the RPC with the cutlist-scoped conflict target.
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
      on conflict (cutlist_id, stage_id, ref_type, ref_id) do nothing;

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
      on conflict (cutlist_id, stage_id, ref_type, ref_id) do nothing;

    elsif s.item_granularity = 'room' then
      insert into production_items (stage_id, cutlist_id, ref_type, ref_id, sort_order)
      select s.id, p_cutlist_id, 'room', cr.room_id,
             coalesce((select max(sort_order) from production_items
                       where stage_id = s.id and cutlist_id = p_cutlist_id), -1)
             + row_number() over (order by cr.sort_order)
      from cutlist_rooms cr
      where cr.cutlist_id = p_cutlist_id
      on conflict (cutlist_id, stage_id, ref_type, ref_id) do nothing;

      delete from production_items pi
      where pi.stage_id = s.id and pi.cutlist_id = p_cutlist_id
        and pi.ref_type = 'room'
        and pi.completed_at is null
        and pi.ref_id not in (
          select cr.room_id from cutlist_rooms cr where cr.cutlist_id = p_cutlist_id
        );
    end if;

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
