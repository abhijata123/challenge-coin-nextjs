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

  IF v_host_username IS NULL THEN
    RAISE EXCEPTION 'Host username not found';
  END IF;

  -- Create notifications for all users
  INSERT INTO notifications (
    user_id,
    type,
    content,
    event_id,
    created_at,
    read
  )
  SELECT 
    ud.email,
    'new_event',
    CASE 
      WHEN ud.email = NEW.host_id THEN
        format('You created a new event: %s', NEW.title)
      ELSE
        format('%s is hosting a new event: %s on %s at %s', 
          v_host_username, 
          NEW.title,
          to_char(NEW.date, 'Month DD, YYYY'),
          NEW.time
        )
    END,
    NEW.id,
    now(),
    ud.email = NEW.host_id -- Mark as read for host
  FROM "User Dps" ud;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in notify_event_creation: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate trigger for event notifications
DROP TRIGGER IF EXISTS notify_event_creation_trigger ON events;
CREATE TRIGGER notify_event_creation_trigger
AFTER INSERT ON events
FOR EACH ROW
EXECUTE FUNCTION notify_event_creation();