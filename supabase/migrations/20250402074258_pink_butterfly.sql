-- Drop existing triggers first
DROP TRIGGER IF EXISTS notify_followers_trigger ON "Challenge Coin Table";
DROP TRIGGER IF EXISTS notify_post_like_trigger ON post_likes;
DROP TRIGGER IF EXISTS notify_post_comment_trigger ON post_comments;
DROP TRIGGER IF EXISTS notify_post_followers_trigger ON posts;

-- Drop existing functions
DROP FUNCTION IF EXISTS notify_followers();
DROP FUNCTION IF EXISTS notify_post_like();
DROP FUNCTION IF EXISTS notify_post_comment();
DROP FUNCTION IF EXISTS notify_post_followers();

-- Create unified notification function for coins
CREATE OR REPLACE FUNCTION notify_followers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username text;
BEGIN
  -- Get username of the coin owner
  SELECT "Username" INTO v_username
  FROM "User Dps"
  WHERE email = NEW."UserId";

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
  WHERE f.following_id = NEW."UserId";
  
  RETURN NEW;
END;
$$;

-- Create notification function for post likes
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

-- Create notification function for post comments
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

-- Create notification function for new posts
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

-- Recreate all triggers
CREATE TRIGGER notify_followers_trigger
AFTER INSERT ON "Challenge Coin Table"
FOR EACH ROW
EXECUTE FUNCTION notify_followers();

CREATE TRIGGER notify_post_like_trigger
AFTER INSERT ON post_likes
FOR EACH ROW
EXECUTE FUNCTION notify_post_like();

CREATE TRIGGER notify_post_comment_trigger
AFTER INSERT ON post_comments
FOR EACH ROW
EXECUTE FUNCTION notify_post_comment();

CREATE TRIGGER notify_post_followers_trigger
AFTER INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION notify_post_followers();