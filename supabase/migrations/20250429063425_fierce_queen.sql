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
    actor_id,
    content,
    reference_id,
    reference_type,
    metadata
  )
  SELECT 
    ud.email,
    'new_event',
    NEW.host_id,
    CASE 
      WHEN ud.email = NEW.host_id THEN
        format('You created a new event: %s', NEW.title)
      ELSE
        format('%s is hosting a new event: %s', v_host_username, NEW.title)
    END,
    NEW.id::text,
    'event',
    jsonb_build_object(
      'event_title', NEW.title,
      'event_date', NEW.date,
      'event_time', NEW.time,
      'event_location', NEW.location,
      'event_type', NEW.type,
      'host_username', v_host_username
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

-- Update existing notifications to include host username
UPDATE notifications n
SET metadata = jsonb_set(
  metadata,
  '{host_username}',
  to_jsonb(ud."Username")
)
FROM "User Dps" ud
WHERE n.actor_id = ud.email
AND n.type = 'new_event'
AND NOT (n.metadata ? 'host_username');