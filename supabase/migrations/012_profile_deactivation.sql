-- Migration 012: Profile deactivation
-- Allows admins to soft-remove users by setting deactivated_at.

alter table public.profiles add column deactivated_at timestamptz;

-- Admins can update any profile (for role changes and deactivation).
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );
