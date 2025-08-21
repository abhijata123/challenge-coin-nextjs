/*
  # Add post notifications functionality
  
  1. Changes
    - Add function to notify followers when a new post is created
    - Update notifications table to handle post references
    
  2. Security
    - Maintain existing security model
*/

-- Function to notify followers of new posts
CREATE OR REPLACE FUNCTION notify_post_followers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_poster_username text;
  v_post_content text;
BEGIN
  -- Get poster's username
  SELECT "Username" INTO v_poster_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Get post content (truncated if needed)
  SELECT SUBSTRING(COALESCE(content, '') FROM 1 FOR 50) INTO v_post_content
  FROM posts
  WHERE id = NEW.id;

  -- Create notifications for all followers
  INSERT INTO notifications (
    user_id,
    type,
    content,
    post_id,
    created_at
  )
  SELECT 
    f.follower_id,
    'new_post',
    format('%s made a new post: "%s%s"', 
      v_poster_username,
      v_post_content,
      CASE WHEN LENGTH(v_post_content) > 50 THEN '...' ELSE '' END
    ),
    NEW.id,
    now()
  FROM followers f
  WHERE f.following_id = NEW.user_id
  AND f.follower_id != NEW.user_id; -- Don't notify yourself

  RETURN NEW;
END;
$$;

-- Create trigger for new post notifications
DROP TRIGGER IF EXISTS notify_post_followers_trigger ON posts;
CREATE TRIGGER notify_post_followers_trigger
AFTER INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION notify_post_followers();