-- Add event_id column to notifications if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'event_id'
  ) THEN
    ALTER TABLE notifications
    ADD COLUMN event_id uuid REFERENCES events(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Function to notify users of new events
CREATE OR REPLACE FUNCTION notify_event_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_host_username text;
BEGIN
  -- Get host's username
  SELECT "Username" INTO v_host_username
  FROM "User Dps"
  WHERE email = NEW.host_id;

  -- Create notifications for all users (including the host)
  INSERT INTO notifications (
    user_id,
    type,
    content,
    event_id,
    created_at,
    read
  )
  SELECT 
    email,
    'new_event',
    format('%s is hosting a new event: %s', v_host_username, NEW.title),
    NEW.id,
    now(),
    false
  FROM "User Dps";

  RETURN NEW;
END;
$$;

-- Create trigger for event notifications
DROP TRIGGER IF EXISTS notify_event_creation_trigger ON events;
CREATE TRIGGER notify_event_creation_trigger
AFTER INSERT ON events
FOR EACH ROW
EXECUTE FUNCTION notify_event_creation();