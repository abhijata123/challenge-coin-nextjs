/*
  # Fix notifications for posts
  
  1. Changes
    - Update notification functions to include post content
    - Add post_id to notifications
    - Improve notification messages
    
  2. Security
    - Maintain SECURITY DEFINER setting
    - Keep existing access controls
*/

-- Add post_id column to notifications if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'post_id'
  ) THEN
    ALTER TABLE notifications
    ADD COLUMN post_id uuid REFERENCES posts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Function to create notification for post like
CREATE OR REPLACE FUNCTION notify_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_owner text;
  v_liker_username text;
  v_post_content text;
BEGIN
  -- Get post owner's email and content
  SELECT user_id, SUBSTRING(content FROM 1 FOR 50) INTO v_post_owner, v_post_content
  FROM posts
  WHERE id = NEW.post_id;

  -- Get liker's username
  SELECT "Username" INTO v_liker_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Only create notification if the liker is not the post owner
  IF NEW.user_id != v_post_owner THEN
    INSERT INTO notifications (
      user_id,
      type,
      content,
      post_id,
      created_at
    )
    VALUES (
      v_post_owner,
      'post_like',
      format('%s liked your post: "%s%s"', 
        v_liker_username, 
        v_post_content,
        CASE WHEN LENGTH(v_post_content) > 50 THEN '...' ELSE '' END
      ),
      NEW.post_id,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Function to create notification for post comment
CREATE OR REPLACE FUNCTION notify_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_owner text;
  v_commenter_username text;
  v_post_content text;
BEGIN
  -- Get post owner's email and content
  SELECT user_id, SUBSTRING(content FROM 1 FOR 50) INTO v_post_owner, v_post_content
  FROM posts
  WHERE id = NEW.post_id;

  -- Get commenter's username
  SELECT "Username" INTO v_commenter_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Only create notification if the commenter is not the post owner
  IF NEW.user_id != v_post_owner THEN
    INSERT INTO notifications (
      user_id,
      type,
      content,
      post_id,
      created_at
    )
    VALUES (
      v_post_owner,
      'post_comment',
      format('%s commented on your post: "%s%s"', 
        v_commenter_username, 
        v_post_content,
        CASE WHEN LENGTH(v_post_content) > 50 THEN '...' ELSE '' END
      ),
      NEW.post_id,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Function to notify followers of new post
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

  -- Get post content
  SELECT SUBSTRING(content FROM 1 FOR 50) INTO v_post_content
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
  WHERE f.following_id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Recreate triggers
DROP TRIGGER IF EXISTS notify_post_like_trigger ON post_likes;
CREATE TRIGGER notify_post_like_trigger
AFTER INSERT ON post_likes
FOR EACH ROW
EXECUTE FUNCTION notify_post_like();

DROP TRIGGER IF EXISTS notify_post_comment_trigger ON post_comments;
CREATE TRIGGER notify_post_comment_trigger
AFTER INSERT ON post_comments
FOR EACH ROW
EXECUTE FUNCTION notify_post_comment();

DROP TRIGGER IF EXISTS notify_post_followers_trigger ON posts;
CREATE TRIGGER notify_post_followers_trigger
AFTER INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION notify_post_followers();