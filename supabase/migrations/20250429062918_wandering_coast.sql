-- Create default notification settings for existing users
INSERT INTO notification_settings (user_id)
SELECT email 
FROM "User Dps"
WHERE email NOT IN (
  SELECT user_id FROM notification_settings
)
ON CONFLICT (user_id) DO NOTHING;

-- Function to create notification settings for new users
CREATE OR REPLACE FUNCTION create_notification_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notification_settings (user_id)
  VALUES (NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger for new user notification settings
CREATE TRIGGER create_notification_settings_trigger
AFTER INSERT ON "User Dps"
FOR EACH ROW
EXECUTE FUNCTION create_notification_settings();

-- Update event notification function to handle null settings
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
      'event_type', NEW.type
    )
  FROM "User Dps" ud
  LEFT JOIN notification_settings ns ON ns.user_id = ud.email
  WHERE ns.events_enabled IS NULL OR ns.events_enabled = true;

  RETURN NEW;
END;
$$;

-- Update coin notification function to handle null settings
CREATE OR REPLACE FUNCTION create_coin_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username text;
BEGIN
  -- Get username
  SELECT "Username" INTO v_username
  FROM "User Dps"
  WHERE email = NEW."UserId";

  -- Create notifications for followers
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
    f.follower_id,
    'new_coin',
    NEW."UserId",
    format('%s added a new coin: %s', v_username, NEW."Coin Name"),
    NEW.id::text,
    'coin',
    jsonb_build_object(
      'coin_name', NEW."Coin Name",
      'coin_image', NEW."Coin Image",
      'date_issued', NEW."Date Issued"
    )
  FROM followers f
  LEFT JOIN notification_settings ns ON ns.user_id = f.follower_id
  WHERE f.following_id = NEW."UserId"
  AND f.follower_id != NEW."UserId"
  AND (ns.coins_enabled IS NULL OR ns.coins_enabled = true);

  RETURN NEW;
END;
$$;

-- Update social notification function to handle null settings
CREATE OR REPLACE FUNCTION create_social_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username text;
  v_post_owner text;
  v_post_content text;
  v_notification_id uuid;
BEGIN
  -- Get username of actor
  SELECT "Username" INTO v_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Get post details
  SELECT 
    user_id,
    SUBSTRING(content FROM 1 FOR 50)
  INTO v_post_owner, v_post_content
  FROM posts
  WHERE id = NEW.post_id;

  -- Create notification if social notifications are enabled or not set
  IF NOT EXISTS (
    SELECT 1 FROM notification_settings 
    WHERE user_id = v_post_owner 
    AND social_enabled = false
  ) THEN
    INSERT INTO notifications (
      recipient_id,
      type,
      actor_id,
      content,
      reference_id,
      reference_type,
      metadata
    )
    VALUES (
      v_post_owner,
      CASE 
        WHEN TG_TABLE_NAME = 'post_likes' THEN 'post_like'
        ELSE 'post_comment'
      END,
      NEW.user_id,
      CASE 
        WHEN TG_TABLE_NAME = 'post_likes' THEN
          format('%s liked your post: "%s%s"', 
            v_username,
            v_post_content,
            CASE WHEN LENGTH(v_post_content) > 50 THEN '...' ELSE '' END
          )
        ELSE
          format('%s commented on your post: "%s%s"', 
            v_username,
            v_post_content,
            CASE WHEN LENGTH(v_post_content) > 50 THEN '...' ELSE '' END
          )
      END,
      NEW.post_id::text,
      'post',
      CASE 
        WHEN TG_TABLE_NAME = 'post_likes' THEN
          jsonb_build_object(
            'post_content', v_post_content,
            'post_id', NEW.post_id
          )
        ELSE
          jsonb_build_object(
            'post_content', v_post_content,
            'post_id', NEW.post_id,
            'comment_content', NEW.content
          )
      END
    )
    RETURNING id INTO v_notification_id;
  END IF;

  RETURN NEW;
END;
$$;