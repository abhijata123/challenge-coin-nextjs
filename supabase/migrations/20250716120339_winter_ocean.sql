/*
  # Restore working notification functions for likes and comments
  
  1. Changes
    - Restore separate notification functions that were working
    - Fix notification table structure compatibility
    - Add proper triggers for post likes and comments
    
  2. Security
    - Maintain existing security model
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
  v_post_content text;
BEGIN
  -- Get post owner's email and content
  SELECT user_id, SUBSTRING(COALESCE(content, '') FROM 1 FOR 50) INTO v_post_owner, v_post_content
  FROM posts
  WHERE id = NEW.post_id;

  -- Don't notify if user is liking their own post
  IF v_post_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get liker's username
  SELECT "Username" INTO v_liker_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Create notification for post owner (using current table structure)
  INSERT INTO notifications (
    recipient_id,
    type,
    content,
    reference_id,
    reference_type,
    metadata,
    created_at
  )
  VALUES (
    v_post_owner,
    'post_like',
    format('%s liked your post%s', 
      v_liker_username,
      CASE 
        WHEN v_post_content IS NOT NULL AND v_post_content != '' 
        THEN format(': "%s%s"', 
          v_post_content,
          CASE WHEN LENGTH(v_post_content) > 50 THEN '...' ELSE '' END
        )
        ELSE ''
      END
    ),
    NEW.post_id::text,
    'post',
    jsonb_build_object('actor_username', v_liker_username),
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
  v_post_content text;
BEGIN
  -- Get post owner's email and content
  SELECT user_id, SUBSTRING(COALESCE(content, '') FROM 1 FOR 50) INTO v_post_owner, v_post_content
  FROM posts
  WHERE id = NEW.post_id;

  -- Don't notify if user is commenting on their own post
  IF v_post_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get commenter's username
  SELECT "Username" INTO v_commenter_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Create notification for post owner (using current table structure)
  INSERT INTO notifications (
    recipient_id,
    type,
    content,
    reference_id,
    reference_type,
    metadata,
    created_at
  )
  VALUES (
    v_post_owner,
    'post_comment',
    format('%s commented on your post%s', 
      v_commenter_username,
      CASE 
        WHEN v_post_content IS NOT NULL AND v_post_content != '' 
        THEN format(': "%s%s"', 
          v_post_content,
          CASE WHEN LENGTH(v_post_content) > 50 THEN '...' ELSE '' END
        )
        ELSE ''
      END
    ),
    NEW.post_id::text,
    'post',
    jsonb_build_object('actor_username', v_commenter_username),
    now()
  );

  RETURN NEW;
END;
$$;

-- Function to create notification for comment like
CREATE OR REPLACE FUNCTION notify_comment_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_comment_owner text;
  v_liker_username text;
  v_comment_content text;
BEGIN
  -- Get comment owner's email and content
  SELECT user_id, SUBSTRING(COALESCE(content, '') FROM 1 FOR 50) INTO v_comment_owner, v_comment_content
  FROM post_comments
  WHERE id = NEW.comment_id;

  -- Don't notify if user is liking their own comment
  IF v_comment_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get liker's username
  SELECT "Username" INTO v_liker_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Create notification for comment owner (using current table structure)
  INSERT INTO notifications (
    recipient_id,
    type,
    content,
    reference_id,
    reference_type,
    metadata,
    created_at
  )
  VALUES (
    v_comment_owner,
    'comment_like',
    format('%s liked your comment%s', 
      v_liker_username,
      CASE 
        WHEN v_comment_content IS NOT NULL AND v_comment_content != '' 
        THEN format(': "%s%s"', 
          v_comment_content,
          CASE WHEN LENGTH(v_comment_content) > 50 THEN '...' ELSE '' END
        )
        ELSE ''
      END
    ),
    NEW.comment_id::text,
    'comment',
    jsonb_build_object('actor_username', v_liker_username),
    now()
  );

  RETURN NEW;
END;
$$;

-- Drop existing triggers and recreate them
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

DROP TRIGGER IF EXISTS notify_comment_like_trigger ON comment_likes;
CREATE TRIGGER notify_comment_like_trigger
AFTER INSERT ON comment_likes
FOR EACH ROW
EXECUTE FUNCTION notify_comment_like();

-- Remove the problematic create_social_notification triggers if they exist
DROP TRIGGER IF EXISTS create_social_notification_trigger_likes ON post_likes;
DROP TRIGGER IF EXISTS create_social_notification_trigger_comments ON post_comments;
DROP TRIGGER IF EXISTS create_social_notification_trigger_comment_likes ON comment_likes;