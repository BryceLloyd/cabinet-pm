-- Migration 027: Simplify roles (deploy-safe subset)
-- Four roles only (admin/office/factory/site); role alone decides view +
-- capability access. We migrate 'member' -> 'office' and tighten the role
-- check constraint. We do NOT drop office_access/production_access here: the
-- currently-deployed app still reads them. They become unused leftovers and
-- are dropped in a later migration once this code is live.

-- 1. Migrate existing 'member' accounts to 'office'.
update public.profiles set role = 'office' where role = 'member';

-- 2. Remove the 'member' default from any allowed_emails so the deployed
--    self-signup trigger can't insert a now-invalid role.
update public.allowed_emails set default_role = 'office' where default_role = 'member';

-- 3. Tighten the role check constraint (drop 'member'). Safe for old code:
--    nothing writes 'member' after steps 1-2.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'office', 'factory', 'site'));
