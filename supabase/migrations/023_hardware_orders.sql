-- Migration 023: First-class hardware orders
-- Hardware orders become their own records that can stand alone or link to a
-- cutlist, replacing the per-cutlist hardware production stage. Status flows
-- To order → Ordered → Completed.

create table public.hardware_orders (
  id           uuid primary key default gen_random_uuid(),
  title        text not null default '',
  cutlist_id   uuid references public.cutlists(id) on delete set null,
  status       text not null default 'to_order' check (status in ('to_order', 'ordered', 'completed')),
  ordered_at   timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_by   uuid references public.profiles(id) on delete set null,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index hardware_orders_cutlist_idx on public.hardware_orders (cutlist_id);
create trigger hardware_orders_touch before update on public.hardware_orders
  for each row execute function public.touch_updated_at();

create table public.hardware_order_items (
  id                uuid primary key default gen_random_uuid(),
  hardware_order_id uuid not null references public.hardware_orders(id) on delete cascade,
  name              text not null,
  qty               int,
  sort_order        int  not null default 0,
  created_at        timestamptz not null default now()
);
create index hardware_order_items_order_idx on public.hardware_order_items (hardware_order_id);

alter table public.hardware_orders enable row level security;
create policy "hardware_orders_all_authed" on public.hardware_orders
  for all to authenticated using (true) with check (true);
alter table public.hardware_order_items enable row level security;
create policy "hardware_order_items_all_authed" on public.hardware_order_items
  for all to authenticated using (true) with check (true);

-- Migrate existing per-cutlist hardware items into first-class hardware orders.
insert into public.hardware_orders (title, cutlist_id, status, created_at)
select c.name || ' hardware', c.id,
  case when exists (
    select 1 from production_items pi
    join production_stages s on s.id = pi.stage_id and s.slug = 'hardware-orders'
    where pi.cutlist_id = c.id and pi.completed_at is not null
  ) then 'completed' else 'to_order' end,
  now()
from cutlists c
where exists (select 1 from cutlist_hardware_items chi where chi.cutlist_id = c.id);

insert into public.hardware_order_items (hardware_order_id, name, qty, sort_order)
select ho.id, chi.name, chi.qty, chi.sort_order
from cutlist_hardware_items chi
join hardware_orders ho on ho.cutlist_id = chi.cutlist_id;

drop table public.cutlist_hardware_items;

-- Remove the hardware production stage (cascades its items/steps).
delete from public.production_stages where slug = 'hardware-orders';
