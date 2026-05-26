-- Migration 002: Phases
-- Configurable pipeline stages. Ordered. Rooms move through these.

create table public.phases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null,
  color text not null default '#94a3b8',  -- slate-400, change in UI
  is_default boolean not null default false,  -- starting phase for new rooms
  created_at timestamptz not null default now(),
  unique (sort_order)
);

alter table public.phases enable row level security;

create policy "phases_select_all"
  on public.phases for select
  to authenticated
  using (true);

-- Only admins can modify phases.
create policy "phases_modify_admin"
  on public.phases for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Ensure only one default phase at a time.
create or replace function public.enforce_single_default_phase()
returns trigger
language plpgsql
as $$
begin
  if new.is_default then
    update public.phases set is_default = false where id != new.id and is_default = true;
  end if;
  return new;
end;
$$;

create trigger phases_single_default
  before insert or update on public.phases
  for each row execute function public.enforce_single_default_phase();
