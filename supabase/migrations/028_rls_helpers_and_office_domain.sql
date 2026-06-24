-- Migration 028: RLS helper functions + office-domain write lock-down.
-- Read stays open to authenticated users; writes on operational tables are
-- restricted to admin/office. (Factory/Site never write these in the UI.)

-- Helper functions (SECURITY DEFINER so they read profiles regardless of RLS).
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

-- Office-domain tables: read = all authenticated; write = office/admin.
do $$
declare
  tbls text[] := array[
    'projects','rooms','room_groups','phase_plans','room_phase_history',
    'tasks','task_checklist_items','calendar_events',
    'cutlists','cutlist_rooms','material_orders',
    'production_items'
  ];
  t text;
  r record;
begin
  foreach t in array tbls loop
    execute format('alter table public.%I enable row level security', t);
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', r.policyname, t);
    end loop;
    execute format('create policy "%1$s_select" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "%1$s_modify" on public.%1$I for all to authenticated using (public.is_office()) with check (public.is_office())', t);
  end loop;
end $$;
