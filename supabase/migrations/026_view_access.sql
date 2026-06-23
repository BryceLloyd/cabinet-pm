-- Migration 026: Office / Production view access
-- Each user can be granted access to the Office view, the Production view, or
-- both (admins manage this in Team settings). Defaults to both so nothing
-- changes for existing accounts until an admin restricts someone.

alter table public.profiles
  add column office_access boolean not null default true,
  add column production_access boolean not null default true;
