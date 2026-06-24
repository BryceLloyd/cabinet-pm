-- Migration 016: Manual task ordering, task checklists (subtasks), and task templates.

-- ── 1. Manual ordering for tasks ───────────────────────────────────────────
alter table public.tasks add column sort_order int not null default 0;

-- Backfill existing rows so the initial order is stable (by creation time).
with ranked as (
  select id, (row_number() over (order by created_at) - 1) as rn
  from public.tasks
)
update public.tasks t
   set sort_order = ranked.rn
  from ranked
 where ranked.id = t.id;

create index tasks_sort_order_idx on public.tasks (sort_order);

-- ── 2. Checklist items (subtasks) ──────────────────────────────────────────
create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index task_checklist_items_task_idx on public.task_checklist_items (task_id);

alter table public.task_checklist_items enable row level security;

-- Visible to anyone who can see the parent task (job tasks: everyone;
-- personal todos: their creator).
create policy "checklist_select" on public.task_checklist_items
  for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (t.project_id is not null or t.room_id is not null or t.created_by = auth.uid())
    )
  );

-- Editable by anyone who can edit the parent task (assignee/creator for job
-- tasks; creator for personal todos).
create policy "checklist_modify" on public.task_checklist_items
  for all to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (
          ((t.project_id is not null or t.room_id is not null)
            and (t.assigned_to = auth.uid() or t.created_by = auth.uid()))
          or (t.project_id is null and t.room_id is null and t.created_by = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (
          ((t.project_id is not null or t.room_id is not null)
            and (t.assigned_to = auth.uid() or t.created_by = auth.uid()))
          or (t.project_id is null and t.room_id is null and t.created_by = auth.uid())
        )
    )
  );

-- ── 3. Task templates (reusable checklists) ────────────────────────────────
create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  items text[] not null default '{}',
  sort_order int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index task_templates_sort_order_idx on public.task_templates (sort_order);

alter table public.task_templates enable row level security;

create policy "task_templates_select" on public.task_templates
  for select to authenticated using (true);
create policy "task_templates_insert" on public.task_templates
  for insert to authenticated with check (true);
create policy "task_templates_update" on public.task_templates
  for update to authenticated using (true);
create policy "task_templates_delete" on public.task_templates
  for delete to authenticated using (true);
