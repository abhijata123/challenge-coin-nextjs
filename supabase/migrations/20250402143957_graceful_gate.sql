-- Update notifications to use email consistently
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
    -- Fallback to getting username from the coin record
    v_username := NEW."Username";
  END IF;

  -- Create notifications for all followers
  INSERT INTO notifications (
    user_id,
    type,
    content,
    coin_id,
    created_at
  )
  SELECT 
    f.follower_id,
    'new_coin',
    format('%s added a new coin: %s', v_username, NEW."Coin Name"),
    NEW.id,
    now()
  FROM followers f
  WHERE f.following_id = v_user_email
  AND f.follower_id != v_user_email; -- Don't notify yourself

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS notify_followers_trigger ON "Challenge Coin Table";
CREATE TRIGGER notify_followers_trigger
AFTER INSERT ON "Challenge Coin Table"
FOR EACH ROW
EXECUTE FUNCTION notify_followers();

-- Update existing notifications to use email consistently
UPDATE notifications n
SET user_id = ud.email
FROM "User Dps" ud
WHERE n.user_id = ud.id::text
AND n.user_id != ud.email;

-- Clean up any orphaned notifications
DELETE FROM notifications
WHERE user_id NOT IN (
  SELECT email FROM "User Dps"
);

-- Update post notification functions to use email
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

  -- Only notify if the liker is not the post owner
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
  END IF;

  RETURN NEW;
END;
$$;

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

  -- Only notify if the commenter is not the post owner
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
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate triggers for post notifications
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