-- Migration 013: Add default duration to phases
-- Allows admins to set a default length (in days) for each phase.

alter table public.phases add column default_duration_days int;
