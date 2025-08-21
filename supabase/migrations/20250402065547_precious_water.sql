/*
  # Add post notifications
  
  1. Changes
    - Add new notification types for post interactions
    - Create triggers for post likes and comments
    - Create trigger for new posts from followed users
    
  2. Security
    - Maintain existing security model
    - Use existing notifications table
*/

-- Function to create notification for post like
CREATE OR REPLACE FUNCTION notify_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_owner text;
  v_liker_username text;
BEGIN
  -- Get post owner's email
  SELECT user_id INTO v_post_owner
  FROM posts
  WHERE id = NEW.post_id;

  -- Get liker's username
  SELECT "Username" INTO v_liker_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Create notification
  INSERT INTO notifications (
    user_id,
    type,
    content,
    created_at
  )
  VALUES (
    v_post_owner,
    'post_like',
    format('%s liked your post', v_liker_username),
    now()
  );

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
BEGIN
  -- Get post owner's email
  SELECT user_id INTO v_post_owner
  FROM posts
  WHERE id = NEW.post_id;

  -- Get commenter's username
  SELECT "Username" INTO v_commenter_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Create notification
  INSERT INTO notifications (
    user_id,
    type,
    content,
    created_at
  )
  VALUES (
    v_post_owner,
    'post_comment',
    format('%s commented on your post', v_commenter_username),
    now()
  );

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
BEGIN
  -- Get poster's username
  SELECT "Username" INTO v_poster_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Create notifications for all followers
  INSERT INTO notifications (
    user_id,
    type,
    content,
    created_at
  )
  SELECT 
    f.follower_id,
    'new_post',
    format('%s made a new post', v_poster_username),
    now()
  FROM followers f
  WHERE f.following_id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Create triggers
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