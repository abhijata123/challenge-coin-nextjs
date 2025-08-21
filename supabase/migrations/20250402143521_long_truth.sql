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