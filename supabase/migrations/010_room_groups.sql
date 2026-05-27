-- Room groups: installation batches within a project
CREATE TABLE room_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX room_groups_project_idx ON room_groups(project_id);

ALTER TABLE room_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage room_groups"
  ON room_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Rooms gain optional group assignment
ALTER TABLE rooms ADD COLUMN room_group_id uuid REFERENCES room_groups(id) ON DELETE SET NULL;
CREATE INDEX rooms_room_group_idx ON rooms(room_group_id);

-- Phase plans: date ranges per (group × phase) or (project × phase)
CREATE TABLE phase_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_group_id   uuid REFERENCES room_groups(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  phase_id        uuid NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT phase_plans_one_parent CHECK (
    (room_group_id IS NOT NULL AND project_id IS NULL) OR
    (room_group_id IS NULL AND project_id IS NOT NULL)
  )
);

CREATE INDEX phase_plans_group_idx ON phase_plans(room_group_id);
CREATE INDEX phase_plans_project_idx ON phase_plans(project_id);
CREATE INDEX phase_plans_date_range_idx ON phase_plans(start_date, end_date);

CREATE TRIGGER phase_plans_touch BEFORE UPDATE ON phase_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE phase_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage phase_plans"
  ON phase_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tasks gain optional room group assignment
ALTER TABLE tasks ADD COLUMN room_group_id uuid REFERENCES room_groups(id) ON DELETE SET NULL;
CREATE INDEX tasks_room_group_idx ON tasks(room_group_id);

-- Profile preference for year plan expansion
ALTER TABLE profiles ADD COLUMN show_room_groups boolean NOT NULL DEFAULT true;
