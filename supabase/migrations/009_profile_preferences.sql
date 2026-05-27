-- Add preference columns to profiles
alter table profiles add column theme_preference text default 'system'
  check (theme_preference in ('light', 'dark', 'system'));

alter table profiles add column density_preference text default 'comfortable'
  check (density_preference in ('compact', 'comfortable'));

alter table profiles add column notification_preferences jsonb default '{}'::jsonb;
