/*
  # Fix notifications functionality
  
  1. Changes
    - Remove actor_id dependency
    - Update notification functions
    - Fix notification creation
    
  2. Security
    - Maintain existing security model
*/

-- Drop existing notifications table and recreate
DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id text NOT NULL,
  type text NOT NULL CHECK (
    type IN ('new_event', 'new_coin', 'post_like', 'post_comment', 'new_post')
  ),
  content text NOT NULL,
  reference_id text,
  reference_type text CHECK (
    reference_type IN ('event', 'coin', 'post', 'comment')
  ),
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create indexes
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_read ON notifications(read) WHERE NOT read;
CREATE INDEX idx_notifications_reference ON notifications(reference_type, reference_id);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') = recipient_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = recipient_id);

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
      'host_username', v_host_username,
      'host_id', NEW.host_id
    )
  FROM "User Dps" ud;

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

  -- Create notifications for followers
  INSERT INTO notifications (
    recipient_id,
    type,
    content,
    reference_id,
    reference_type,
    metadata
  )
  SELECT 
    f.follower_id,
    'new_coin',
    format('%s added a new coin: %s', v_username, NEW."Coin Name"),
    NEW.id::text,
    'coin',
    jsonb_build_object(
      'coin_name', NEW."Coin Name",
      'coin_image', NEW."Coin Image",
      'date_issued', NEW."Date Issued",
      'username', v_username,
      'user_id', NEW."UserId"
    )
  FROM followers f
  WHERE f.following_id = NEW."UserId"
  AND f.follower_id != NEW."UserId";

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
BEGIN
  -- Get username of actor
  SELECT "Username" INTO v_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Get post details
  SELECT 
    user_id,
    COALESCE(content, '')
  INTO v_post_owner, v_post_content
  FROM posts
  WHERE id = NEW.post_id;

  -- Don't create notification if user is interacting with their own post
  IF v_post_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Create notification
  INSERT INTO notifications (
    recipient_id,
    type,
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
    CASE 
      WHEN TG_TABLE_NAME = 'post_likes' THEN
        CASE 
          WHEN v_post_content = '' THEN
            format('%s liked your post', v_username)
          ELSE
            format('%s liked your post: "%s%s"', 
              v_username,
              SUBSTRING(v_post_content FROM 1 FOR 50),
              CASE WHEN LENGTH(v_post_content) > 50 THEN '...' ELSE '' END
            )
        END
      ELSE
        CASE 
          WHEN v_post_content = '' THEN
            format('%s commented on your post', v_username)
          ELSE
            format('%s commented on your post: "%s%s"', 
              v_username,
              SUBSTRING(v_post_content FROM 1 FOR 50),
              CASE WHEN LENGTH(v_post_content) > 50 THEN '...' ELSE '' END
            )
        END
    END,
    NEW.post_id::text,
    'post',
    jsonb_build_object(
      'post_id', NEW.post_id,
      'post_content', v_post_content,
      'username', v_username,
      'user_id', NEW.user_id
    )
  );

  RETURN NEW;
END;
$$;

-- Recreate triggers
DROP TRIGGER IF EXISTS create_event_notification_trigger ON events;
DROP TRIGGER IF EXISTS create_coin_notification_trigger ON "Challenge Coin Table";
DROP TRIGGER IF EXISTS create_social_notification_trigger_likes ON post_likes;
DROP TRIGGER IF EXISTS create_social_notification_trigger_comments ON post_comments;

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