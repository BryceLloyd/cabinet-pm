-- Migration 007: Fix room_phase_history RLS for trigger writes
--
-- The log_room_phase_change() trigger runs as the calling user, not as
-- SECURITY DEFINER.  It inserts and updates rows in room_phase_history,
-- but only a SELECT policy existed → any room insert/update that set
-- current_phase_id returned 403.
--
-- Fix: add INSERT and UPDATE policies so the trigger can write history.

create policy "room_phase_history_insert_authed"
  on public.room_phase_history
  for insert to authenticated
  with check (true);

create policy "room_phase_history_update_authed"
  on public.room_phase_history
  for update to authenticated
  using (true)
  with check (true);
