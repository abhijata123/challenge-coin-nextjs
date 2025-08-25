-- Drop existing notifications table and related objects
DROP TABLE IF EXISTS notifications CASCADE;
DROP TRIGGER IF EXISTS notify_followers_trigger ON "Challenge Coin Table";
DROP TRIGGER IF EXISTS notify_post_like_trigger ON post_likes;
DROP TRIGGER IF EXISTS notify_post_comment_trigger ON post_comments;
DROP TRIGGER IF EXISTS notify_post_followers_trigger ON posts;
DROP TRIGGER IF EXISTS notify_event_creation_trigger ON events;

-- Create new notifications table
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id text NOT NULL REFERENCES "User Dps"(email) ON DELETE CASCADE,
  type text NOT NULL CHECK (
    type IN ('new_event', 'new_coin', 'post_like', 'post_comment', 'new_post')
  ),
  actor_id text REFERENCES "User Dps"(email) ON DELETE CASCADE,
  content text NOT NULL,
  reference_id text,  -- Can be event_id, coin_id, post_id etc.
  reference_type text CHECK (
    reference_type IN ('event', 'coin', 'post', 'comment')
  ),
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT valid_reference CHECK (
    (reference_id IS NULL AND reference_type IS NULL) OR
    (reference_id IS NOT NULL AND reference_type IS NOT NULL)
  )
);

-- Create notification settings table
CREATE TABLE notification_settings (
  user_id text PRIMARY KEY REFERENCES "User Dps"(email) ON DELETE CASCADE,
  events_enabled boolean DEFAULT true,
  coins_enabled boolean DEFAULT true,
  social_enabled boolean DEFAULT true,
  last_read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_read ON notifications(read) WHERE NOT read;
CREATE INDEX idx_notifications_reference ON notifications(reference_type, reference_id);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = recipient_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = recipient_id);

CREATE POLICY "Users can manage their notification settings"
  ON notification_settings FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'email' = user_id)
  WITH CHECK (auth.jwt() ->> 'email' = user_id);

-- Function to create event notifications
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

  -- Create notifications for all users with enabled event notifications
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
  INNER JOIN notification_settings ns ON ns.user_id = ud.email
  WHERE ns.events_enabled = true;

  RETURN NEW;
END;
$$;

-- Function to create coin notifications
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

  -- Create notifications for followers with enabled coin notifications
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
  INNER JOIN notification_settings ns ON ns.user_id = f.follower_id
  WHERE f.following_id = NEW."UserId"
  AND f.follower_id != NEW."UserId"
  AND ns.coins_enabled = true;

  RETURN NEW;
END;
$$;

-- Function to create social notifications
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

  -- Only create notification if social notifications are enabled
  IF EXISTS (
    SELECT 1 FROM notification_settings 
    WHERE user_id = v_post_owner 
    AND social_enabled = true
  ) THEN
    -- Create notification based on trigger source
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

-- Create triggers
CREATE TRIGGER create_event_notification_trigger
AFTER INSERT ON events
FOR EACH ROW
EXECUTE FUNCTION create_event_notification();

CREATE TRIGGER create_coin_notification_trigger
AFTER INSERT ON "Challenge Coin Table"
FOR EACH ROW
EXECUTE FUNCTION create_coin_notification();

CREATE TRIGGER create_social_notification_trigger_likes
AFTER INSERT ON post_likes
FOR EACH ROW
EXECUTE FUNCTION create_social_notification();

CREATE TRIGGER create_social_notification_trigger_comments
AFTER INSERT ON post_comments
FOR EACH ROW
EXECUTE FUNCTION create_social_notification();

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_as_read(p_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE notifications
  SET read = true
  WHERE recipient_id = p_user_id
  AND NOT read;

  UPDATE notification_settings
  SET 
    last_read_at = now(),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;