-- Migration 029: settings table RLS.
-- System settings = admin only. Production settings = office/admin.

-- System settings: read = all authenticated; write = admin.
do $$
declare
  tbls text[] := array['phases','task_types','event_types','task_templates','business_info'];
  t text;
  r record;
begin
  foreach t in array tbls loop
    execute format('alter table public.%I enable row level security', t);
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', r.policyname, t);
    end loop;
    execute format('create policy "%1$s_select" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "%1$s_modify" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- business_info is read on the login page before auth — keep a public read policy.
drop policy if exists "business_info_select" on public.business_info;
create policy "business_info_public_select" on public.business_info for select using (true);

-- Production settings: read = all authenticated; write = office/admin.
do $$
declare
  tbls text[] := array['materials','hardware_catalog','paint_types','suppliers','production_stages','production_steps'];
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
