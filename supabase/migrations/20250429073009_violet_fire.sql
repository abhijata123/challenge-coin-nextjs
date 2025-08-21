-- Update notifications table to properly handle event references
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS valid_reference;

-- Update event notification function to fix event display
CREATE OR REPLACE FUNCTION create_event_notification()
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

  -- Create notifications for all users
  INSERT INTO notifications (
    recipient_id,
    type,
    content,
    reference_id,
    reference_type,
    metadata
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
    NEW.id::text,
    'event',
    jsonb_build_object(
      'event_title', NEW.title,
      'event_date', NEW.date,
      'event_time', NEW.time,
      'event_location', NEW.location,
      'event_type', NEW.type,
      'host_username', v_host_username,
      'host_id', NEW.host_id,
      'max_attendees', NEW.max_attendees,
      'current_attendees', NEW.current_attendees,
      'requires_coin', NEW.requires_coin,
      'coin_type', NEW.coin_type
    )
  FROM "User Dps" ud;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS create_event_notification_trigger ON events;
CREATE TRIGGER create_event_notification_trigger
AFTER INSERT ON events
FOR EACH ROW
EXECUTE FUNCTION create_event_notification();