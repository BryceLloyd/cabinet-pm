-- Migration 008: Add archived_at for phase soft-delete, drop sort_order unique constraint for drag reorder
alter table public.phases add column archived_at timestamptz;
alter table public.phases drop constraint phases_sort_order_key;
