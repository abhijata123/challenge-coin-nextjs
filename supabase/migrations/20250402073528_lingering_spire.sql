-- Update notification functions to handle all cases
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

  -- Get liker's username
  SELECT "Username" INTO v_liker_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Create notification for post owner
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
    NEW.post_id,
    now()
  );

  RETURN NEW;
END;
$$;

-- Update comment notification function
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

  -- Get commenter's username
  SELECT "Username" INTO v_commenter_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Create notification for post owner
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
    NEW.post_id,
    now()
  );

  RETURN NEW;
END;
$$;

-- Update post followers notification function
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
    format('%s made a new post%s', 
      v_poster_username,
      CASE 
        WHEN v_post_content IS NOT NULL AND v_post_content != '' 
        THEN format(': "%s%s"', 
          v_post_content,
          CASE WHEN LENGTH(v_post_content) > 50 THEN '...' ELSE '' END
        )
        ELSE ''
      END
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