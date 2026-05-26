-- Allowed emails: only these addresses can get a profile and access the app.
create table if not exists public.allowed_emails (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  default_role text not null default 'member',
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;

create policy "Admins can view allowed emails"
  on public.allowed_emails for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can insert allowed emails"
  on public.allowed_emails for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can delete allowed emails"
  on public.allowed_emails for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Seed the existing admin
insert into public.allowed_emails (email, default_role)
values ('bryceblloyd@gmail.com', 'admin')
on conflict (email) do nothing;

-- Replace the trigger: only create a profile for allowed emails
create or replace function public.handle_new_user()
returns trigger as $$
declare
  allowed record;
begin
  select * into allowed from public.allowed_emails where lower(email) = lower(new.email);
  if found then
    insert into public.profiles (id, full_name, role)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      allowed.default_role
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;
