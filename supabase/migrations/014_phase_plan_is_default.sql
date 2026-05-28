-- Track whether a phase plan duration follows the phase default or was manually set
ALTER TABLE public.phase_plans ADD COLUMN is_default boolean NOT NULL DEFAULT true;

-- RPC: recalculate all project-level phase plans that still use defaults
-- Called when a phase's default_duration_days changes in settings
CREATE OR REPLACE FUNCTION public.sync_phase_defaults(p_phase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  proj RECORD;
  ph_plan RECORD;
  cursor_date DATE;
  dur INT;
  phase_end DATE;
  phase_start DATE;
BEGIN
  -- For each project that has a default (non-custom) plan for this phase
  FOR proj IN
    SELECT DISTINCT pp.project_id, p.estimated_completion_date
    FROM phase_plans pp
    JOIN projects p ON p.id = pp.project_id
    WHERE pp.phase_id = p_phase_id
      AND pp.is_default = true
      AND pp.room_group_id IS NULL
  LOOP
    -- Recalculate ALL project-level plans for this project (dates shift)
    cursor_date := proj.estimated_completion_date::date;

    FOR ph_plan IN
      SELECT pp.id, pp.phase_id, pp.is_default, pp.start_date, pp.end_date
      FROM phase_plans pp
      JOIN phases ph ON ph.id = pp.phase_id
      WHERE pp.project_id = proj.project_id
        AND pp.room_group_id IS NULL
        AND ph.archived_at IS NULL
      ORDER BY ph.sort_order DESC
    LOOP
      IF ph_plan.is_default THEN
        dur := COALESCE(
          (SELECT default_duration_days FROM phases WHERE id = ph_plan.phase_id),
          ph_plan.end_date - ph_plan.start_date + 1
        );
      ELSE
        dur := ph_plan.end_date - ph_plan.start_date + 1;
      END IF;

      phase_end := cursor_date;
      phase_start := phase_end - (dur - 1);

      UPDATE phase_plans
      SET start_date = phase_start, end_date = phase_end
      WHERE id = ph_plan.id;

      cursor_date := phase_start - 1;
    END LOOP;
  END LOOP;
END;
$$;
