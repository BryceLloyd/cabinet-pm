-- Migration 015: Notifications & Push Subscriptions
-- In-app + web push notification system.

----------------------------------------------------------------------
-- 1. notifications table
----------------------------------------------------------------------
CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN (
                'task_assigned', 'task_due_today', 'phase_changed', 'event_reminder'
              )),
  title       text NOT NULL,
  body        text,
  url         text,
  metadata    jsonb,
  read_at     timestamptz,
  push_sent_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_idx
  ON notifications (user_id, created_at DESC);

CREATE INDEX notifications_user_unread_idx
  ON notifications (user_id)
  WHERE read_at IS NULL;

CREATE INDEX notifications_push_unsent_idx
  ON notifications (id)
  WHERE push_sent_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark read)
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Triggers insert via SECURITY DEFINER — need a service-role policy
-- so the trigger functions can insert for any user.
CREATE POLICY "notifications_insert_trigger"
  ON notifications FOR INSERT
  WITH CHECK (true);

----------------------------------------------------------------------
-- 2. push_subscriptions table
----------------------------------------------------------------------
CREATE TABLE push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text UNIQUE NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_select_own"
  ON push_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_insert_own"
  ON push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_update_own"
  ON push_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_delete_own"
  ON push_subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

----------------------------------------------------------------------
-- 3. Backfill notification_preferences with defaults
----------------------------------------------------------------------
UPDATE profiles
SET notification_preferences = '{
  "task_assigned": true,
  "task_due_today": true,
  "phase_changed": true,
  "event_reminder": true
}'::jsonb
WHERE notification_preferences = '{}'::jsonb
   OR notification_preferences IS NULL;

-- Update default for new profiles
ALTER TABLE profiles
  ALTER COLUMN notification_preferences
  SET DEFAULT '{
    "task_assigned": true,
    "task_due_today": true,
    "phase_changed": true,
    "event_reminder": true
  }'::jsonb;

----------------------------------------------------------------------
-- 4. notify_task_assigned() trigger function
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs jsonb;
  v_project_name text;
BEGIN
  -- Only fire if assigned_to is set and changed
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, skip if assigned_to didn't change
  IF TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  -- Don't notify if you assigned to yourself
  IF NEW.assigned_to = NEW.created_by THEN
    RETURN NEW;
  END IF;

  -- Check recipient preferences
  SELECT notification_preferences INTO v_prefs
  FROM profiles WHERE id = NEW.assigned_to;

  IF COALESCE(v_prefs->>'task_assigned', 'true') = 'false' THEN
    RETURN NEW;
  END IF;

  -- Get project name for the notification body
  SELECT p.name INTO v_project_name
  FROM projects p WHERE p.id = NEW.project_id;

  INSERT INTO notifications (user_id, type, title, body, url, metadata)
  VALUES (
    NEW.assigned_to,
    'task_assigned',
    'Task assigned to you',
    NEW.title || COALESCE(' — ' || v_project_name, ''),
    '/tasks?highlight=' || NEW.id,
    jsonb_build_object('task_id', NEW.id, 'project_id', NEW.project_id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_task_assigned
  AFTER INSERT OR UPDATE OF assigned_to ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_assigned();

----------------------------------------------------------------------
-- 5. notify_phase_changed() trigger function
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_phase_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_project_creator uuid;
  v_room_name text;
  v_phase_name text;
  v_recipient uuid;
BEGIN
  -- Only fire if phase actually changed
  IF NEW.current_phase_id IS NOT DISTINCT FROM OLD.current_phase_id THEN
    RETURN NEW;
  END IF;

  -- Get room and phase info
  v_room_name := NEW.name;
  v_project_id := NEW.project_id;

  SELECT name INTO v_phase_name
  FROM phases WHERE id = NEW.current_phase_id;

  SELECT created_by INTO v_project_creator
  FROM projects WHERE id = v_project_id;

  -- Collect recipients: project creator + users with incomplete tasks in this room
  FOR v_recipient IN
    SELECT DISTINCT unnest(ARRAY[v_project_creator] ||
      ARRAY(
        SELECT DISTINCT t.assigned_to
        FROM tasks t
        WHERE t.room_id = NEW.id
          AND t.completed_at IS NULL
          AND t.assigned_to IS NOT NULL
      )
    )
  LOOP
    -- Skip nulls
    IF v_recipient IS NULL THEN
      CONTINUE;
    END IF;

    -- Check recipient preferences
    IF (SELECT COALESCE(notification_preferences->>'phase_changed', 'true')
        FROM profiles WHERE id = v_recipient) = 'false' THEN
      CONTINUE;
    END IF;

    INSERT INTO notifications (user_id, type, title, body, url, metadata)
    VALUES (
      v_recipient,
      'phase_changed',
      'Phase changed',
      v_room_name || ' moved to ' || COALESCE(v_phase_name, 'unknown'),
      '/projects/' || v_project_id,
      jsonb_build_object('room_id', NEW.id, 'project_id', v_project_id, 'phase_id', NEW.current_phase_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_phase_changed
  AFTER UPDATE OF current_phase_id ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION notify_phase_changed();
