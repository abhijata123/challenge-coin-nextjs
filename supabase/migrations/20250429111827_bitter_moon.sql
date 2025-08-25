-- Add timezone column to events table
ALTER TABLE events
ADD COLUMN timezone text DEFAULT 'UTC';

-- Update event notification function to include timezone
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
        format('%s is hosting a new event: %s on %s at %s %s', 
          v_host_username, 
          NEW.title,
          to_char(NEW.date, 'Month DD, YYYY'),
          NEW.time,
          NEW.timezone
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
      'timezone', NEW.timezone,
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