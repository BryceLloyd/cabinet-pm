-- Migration 004: Tasks
-- Single table for job tasks (linked to project/room) AND personal todos.
-- If project_id and room_id are both null, it's a personal todo for the creator.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  due_date date,

  project_id uuid references public.projects(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete cascade,

  assigned_to uuid references public.profiles(id) on delete set null,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,

  priority int not null default 2 check (priority between 1 and 3),  -- 1=high, 2=normal, 3=low

  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A personal todo (no project/room) must be assigned to its creator.
  constraint personal_todo_self_assigned
    check (
      (project_id is not null or room_id is not null)
      or (assigned_to is null or assigned_to = created_by)
    )
);

create index tasks_assigned_idx on public.tasks (assigned_to) where completed_at is null;
create index tasks_project_idx on public.tasks (project_id) where project_id is not null;
create index tasks_room_idx on public.tasks (room_id) where room_id is not null;
create index tasks_personal_idx on public.tasks (created_by) where project_id is null and room_id is null;

create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

alter table public.tasks enable row level security;

-- Job tasks visible to all; personal todos only to their creator.
create policy "tasks_select" on public.tasks
  for select to authenticated
  using (
    project_id is not null
    or room_id is not null
    or created_by = auth.uid()
  );

-- Anyone can create job tasks; personal todos must be self-created.
create policy "tasks_insert" on public.tasks
  for insert to authenticated
  with check (
    created_by = auth.uid()
  );

-- Job tasks: assignee or creator can update. Personal todos: only creator.
create policy "tasks_update" on public.tasks
  for update to authenticated
  using (
    (project_id is not null or room_id is not null)
      and (assigned_to = auth.uid() or created_by = auth.uid())
    or
    (project_id is null and room_id is null and created_by = auth.uid())
  );

create policy "tasks_delete" on public.tasks
  for delete to authenticated
  using (created_by = auth.uid());
