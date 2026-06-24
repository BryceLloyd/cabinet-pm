-- Migration 031: drop the now-unused view-access columns.
-- Step 1 left these in place so the live site (which still read them) kept
-- working through the deploy. By the time this runs, Step 1's code is live and
-- nothing references them.
alter table public.profiles drop column if exists office_access;
alter table public.profiles drop column if exists production_access;
