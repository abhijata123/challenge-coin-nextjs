/*
  # Enhance notification system
  
  1. Changes
    - Add indexes for better notification performance
    - Update notification functions for better content handling
    - Add timestamp tracking for notifications
    
  2. Security
    - Maintain existing security model
*/

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_followers_following_id ON followers(following_id);
CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);

-- Function to notify followers of new posts with better content handling
CREATE OR REPLACE FUNCTION notify_post_followers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_poster_username text;
  v_post_content text;
  v_image_preview text;
BEGIN
  -- Get poster's username
  SELECT "Username" INTO v_poster_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Get post content and image preview
  v_post_content := COALESCE(NEW.content, '');
  v_image_preview := CASE 
    WHEN NEW.image_url IS NOT NULL THEN ' [Image attached]'
    ELSE ''
  END;

  -- Create notifications for all followers
  INSERT INTO notifications (
    user_id,
    type,
    content,
    post_id,
    created_at,
    read
  )
  SELECT 
    f.follower_id,
    'new_post',
    format('%s posted: "%s%s"%s', 
      v_poster_username,
      SUBSTRING(v_post_content FROM 1 FOR 50),
      CASE WHEN LENGTH(v_post_content) > 50 THEN '...' ELSE '' END,
      v_image_preview
    ),
    NEW.id,
    now(),
    false
  FROM followers f
  WHERE f.following_id = NEW.user_id
  AND f.follower_id != NEW.user_id; -- Don't notify yourself

  RETURN NEW;
END;
$$;

-- Function to notify followers of new coins with better content handling
CREATE OR REPLACE FUNCTION notify_followers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username text;
  v_user_email text;
BEGIN
  -- Get username and email of the coin owner
  v_user_email := NEW."UserId";
  
  SELECT "Username" INTO v_username
  FROM "User Dps"
  WHERE email = v_user_email;

  IF v_username IS NULL THEN
    v_username := NEW."Username";
  END IF;

  -- Create notifications for all followers
  INSERT INTO notifications (
    user_id,
    type,
    content,
    coin_id,
    created_at,
    read
  )
  SELECT 
    f.follower_id,
    'new_coin',
    format('%s added a new %s coin: %s', 
      v_username,
      NEW."Rarity Level",
      NEW."Coin Name"
    ),
    NEW.id,
    now(),
    false
  FROM followers f
  WHERE f.following_id = v_user_email
  AND f.follower_id != v_user_email; -- Don't notify yourself

  RETURN NEW;
END;
$$;

-- Recreate triggers
DROP TRIGGER IF EXISTS notify_post_followers_trigger ON posts;
CREATE TRIGGER notify_post_followers_trigger
AFTER INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION notify_post_followers();

DROP TRIGGER IF EXISTS notify_followers_trigger ON "Challenge Coin Table";
CREATE TRIGGER notify_followers_trigger
AFTER INSERT ON "Challenge Coin Table"
FOR EACH ROW
EXECUTE FUNCTION notify_followers();

-- Update existing notifications to ensure proper read status
UPDATE notifications
SET read = false
WHERE read IS NULL;