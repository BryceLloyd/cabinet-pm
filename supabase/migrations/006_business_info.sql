-- Business info: single-row table for company details displayed across the app.
create table if not exists public.business_info (
  id int primary key default 1 check (id = 1),
  name text not null default '',
  logo_url text,
  address text,
  phone text,
  email text,
  workshop_photo_url text,
  updated_at timestamptz not null default now()
);

alter table public.business_info enable row level security;

-- Anyone can read (data appears on the unauthenticated login screen)
create policy "Public can view business info"
  on public.business_info for select
  using (true);

-- Only admins can update
create policy "Admins can update business info"
  on public.business_info for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Allow admin insert (for the seed row via app, if it doesn't exist yet)
create policy "Admins can insert business info"
  on public.business_info for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Seed the single row
insert into public.business_info (id) values (1) on conflict (id) do nothing;

-- Reuse existing touch_updated_at trigger
create trigger business_info_touch before update on public.business_info
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- Storage bucket: business-assets
-- ============================================================================
-- Supabase Storage buckets cannot be reliably created via SQL migrations.
-- You must create the bucket manually in the Supabase dashboard:
--
-- 1. Go to Storage in the Supabase dashboard
-- 2. Click "New bucket"
-- 3. Name: business-assets
-- 4. Toggle ON "Public bucket" (images appear on the login page, which is
--    unauthenticated)
-- 5. Under Policies, add:
--    - SELECT: allow public access (anon + authenticated)
--    - INSERT: only authenticated users with admin role
--      Policy: (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
--    - UPDATE: same as INSERT
--    - DELETE: same as INSERT
--
-- See also: docs/setup-storage.md
