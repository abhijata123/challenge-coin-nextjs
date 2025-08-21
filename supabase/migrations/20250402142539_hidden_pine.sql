-- Drop existing function and recreate with improved notification handling
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
  SELECT "Username", email INTO v_username, v_user_email
  FROM "User Dps"
  WHERE email = NEW."UserId";

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

-- Fix existing notifications to ensure proper references
UPDATE notifications n
SET 
  user_id = COALESCE(
    (
      SELECT email 
      FROM "User Dps" 
      WHERE id::text = n.user_id 
      OR email = n.user_id
      LIMIT 1
    ),
    n.user_id
  )
WHERE n.type = 'new_coin';

-- Clean up any orphaned notifications
DELETE FROM notifications
WHERE coin_id IS NOT NULL 
AND NOT EXISTS (
  SELECT 1 
  FROM "Challenge Coin Table" 
  WHERE id = notifications.coin_id
);