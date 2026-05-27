-- Event types: categorize calendar events (Template, Worktop Install, etc.)
CREATE TABLE event_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#94a3b8',
  sort_order  int  NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage event_types"
  ON event_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Calendar events: shared events visible to everyone
CREATE TABLE calendar_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL,
  event_date     date NOT NULL,
  event_type_id  uuid REFERENCES event_types(id) ON DELETE SET NULL,
  project_id     uuid REFERENCES projects(id) ON DELETE CASCADE,
  room_group_id  uuid REFERENCES room_groups(id) ON DELETE SET NULL,
  notes          text,
  created_by     uuid NOT NULL REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX calendar_events_date_idx ON calendar_events(event_date);
CREATE INDEX calendar_events_project_idx ON calendar_events(project_id);
CREATE INDEX calendar_events_type_idx ON calendar_events(event_type_id);

CREATE TRIGGER calendar_events_touch BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage calendar_events"
  ON calendar_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
