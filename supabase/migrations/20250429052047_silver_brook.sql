/*
  # Fix event notifications
  
  1. Changes
    - Update notify_event_creation function to properly handle notifications
    - Add better error handling
    - Ensure notifications are created for all users
    
  2. Security
    - Maintain existing security model
*/

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

  -- Create notification for the host
  INSERT INTO notifications (
    user_id,
    type,
    content,
    event_id,
    created_at,
    read
  )
  VALUES (
    NEW.host_id,
    'new_event',
    format('You created a new event: %s', NEW.title),
    NEW.id,
    now(),
    true
  );

  -- Create notifications for all other users
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
    format('%s is hosting a new event: %s on %s', 
      v_host_username, 
      NEW.title,
      to_char(NEW.date, 'Month DD, YYYY')
    ),
    NEW.id,
    now(),
    false
  FROM "User Dps" ud
  WHERE ud.email != NEW.host_id;

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