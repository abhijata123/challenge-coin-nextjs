/*
  # Fix notifications functionality
  
  1. Changes
    - Update notify_followers function to use correct user IDs
    - Fix notification content and links
    - Ensure proper user references
    
  2. Security
    - Maintain SECURITY DEFINER setting
    - Keep existing access controls
*/

-- Drop existing function and recreate with fixes
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
  WHERE f.following_id = v_user_email;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS notify_followers_trigger ON "Challenge Coin Table";
CREATE TRIGGER notify_followers_trigger
AFTER INSERT ON "Challenge Coin Table"
FOR EACH ROW
EXECUTE FUNCTION notify_followers();

-- Update existing notifications to fix any broken references
UPDATE notifications n
SET user_id = ud.email
FROM "User Dps" ud
WHERE n.user_id = ud.id::text;

-- Clean up any orphaned notifications
DELETE FROM notifications
WHERE coin_id IS NOT NULL 
AND NOT EXISTS (
  SELECT 1 
  FROM "Challenge Coin Table" 
  WHERE id = notifications.coin_id
);