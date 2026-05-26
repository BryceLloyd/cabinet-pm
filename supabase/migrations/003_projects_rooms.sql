-- Migration 003: Projects and Rooms
-- Project: top-level job for a client. Rooms: sub-units within a project.
-- Backward scheduling: start_date = estimated_completion_date - (lead_time_weeks * 7).

create type project_status as enum ('planning', 'active', 'on_hold', 'complete', 'cancelled');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text,
  site_address text,
  notes text,

  estimated_completion_date date not null,
  lead_time_weeks int not null default 8 check (lead_time_weeks > 0),
  -- Generated: derived start date. Override via lead_time_weeks per project.
  start_date date generated always as (estimated_completion_date - (lead_time_weeks * 7)) stored,

  current_phase_id uuid references public.phases(id) on delete set null,
  status project_status not null default 'planning',

  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_completion_idx on public.projects (estimated_completion_date);
create index projects_status_idx on public.projects (status);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  notes text,
  sort_order int not null default 0,

  current_phase_id uuid references public.phases(id) on delete set null,
  -- Optional per-room scheduling for finer Gantt detail.
  estimated_start date,
  estimated_end date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rooms_project_idx on public.rooms (project_id);

-- Phase history: audit trail of when each room entered/exited a phase.
create table public.room_phase_history (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  phase_id uuid not null references public.phases(id),
  entered_at timestamptz not null default now(),
  entered_by uuid references public.profiles(id),
  exited_at timestamptz,
  notes text
);

create index room_phase_history_room_idx on public.room_phase_history (room_id, entered_at desc);

-- Auto-update updated_at.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();

-- When a room's phase changes, close out the previous history entry and open a new one.
create or replace function public.log_room_phase_change()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT' and new.current_phase_id is not null)
     or (tg_op = 'UPDATE' and new.current_phase_id is distinct from old.current_phase_id) then
    -- Close previous open entry
    update public.room_phase_history
      set exited_at = now()
      where room_id = new.id and exited_at is null;
    -- Open new entry
    if new.current_phase_id is not null then
      insert into public.room_phase_history (room_id, phase_id, entered_by)
        values (new.id, new.current_phase_id, auth.uid());
    end if;
  end if;
  return new;
end;
$$;

create trigger rooms_log_phase
  after insert or update of current_phase_id on public.rooms
  for each row execute function public.log_room_phase_change();

-- RLS: all team members see and edit everything in projects/rooms (small team).
alter table public.projects enable row level security;
alter table public.rooms enable row level security;
alter table public.room_phase_history enable row level security;

create policy "projects_all_authed" on public.projects
  for all to authenticated using (true) with check (true);

create policy "rooms_all_authed" on public.rooms
  for all to authenticated using (true) with check (true);

create policy "room_phase_history_select_all" on public.room_phase_history
  for select to authenticated using (true);
-- History is written by trigger, no manual insert needed.
