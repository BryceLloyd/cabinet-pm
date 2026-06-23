-- Migration 018: Production roles
-- Widen profiles.role to add factory-floor roles. Existing 'admin'/'member'
-- rows stay valid; 'member' maps to office-level (all-section) visibility in
-- app code (lib/production/access.ts). Section visibility per role is enforced
-- in server components, not in the DB.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'office', 'factory', 'site', 'member'));
