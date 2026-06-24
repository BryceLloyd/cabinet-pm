-- Task types (configurable labels like Cutlist, Quote, Site, Factory)
create table task_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#94a3b8',
  sort_order  int  not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

alter table task_types enable row level security;

create policy "Authenticated users can read task types"
  on task_types for select to authenticated using (true);
create policy "Authenticated users can insert task types"
  on task_types for insert to authenticated with check (true);
create policy "Authenticated users can update task types"
  on task_types for update to authenticated using (true);

-- Add task_type_id to tasks
alter table tasks add column task_type_id uuid references task_types(id) on delete set null;
create index tasks_task_type_idx on tasks (task_type_id) where task_type_id is not null;

-- Seed default task types
insert into task_types (name, color, sort_order) values
  ('Cutlist',  '#3b82f6', 0),
  ('Quote',    '#f59e0b', 1),
  ('Site',     '#22c55e', 2),
  ('Factory',  '#8b5cf6', 3);
