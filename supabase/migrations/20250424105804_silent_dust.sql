-- Drop rarity level constraint and column
DO $$ 
BEGIN
  -- Drop the constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'rarity_level_check'
  ) THEN
    ALTER TABLE "Challenge Coin Table"
    DROP CONSTRAINT rarity_level_check;
  END IF;

  -- Drop the column if it exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'Challenge Coin Table' 
    AND column_name = 'Rarity Level'
  ) THEN
    ALTER TABLE "Challenge Coin Table"
    DROP COLUMN "Rarity Level";
  END IF;

  -- Drop the column from pending_coin_transfers if it exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'pending_coin_transfers' 
    AND column_name = 'rarity_level'
  ) THEN
    ALTER TABLE pending_coin_transfers
    DROP COLUMN rarity_level;
  END IF;
END $$;

-- Clean up any references to Rarity Level in notifications
UPDATE notifications 
SET content = regexp_replace(content, ' [A-Za-z]+ coin:', ' coin:', 'g')
WHERE type = 'new_coin';

-- Update notify_followers function to remove rarity level references
CREATE OR REPLACE FUNCTION notify_followers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username text;
  v_user_email text;
BEGIN
  v_user_email := NEW."UserId";
  
  SELECT "Username" INTO v_username
  FROM "User Dps"
  WHERE email = v_user_email;

  IF v_username IS NULL THEN
    v_username := NEW."Username";
  END IF;

  INSERT INTO notifications (
    user_id,
    type,
    content,
    coin_id,
    created_at,
    read
  )
  SELECT 
    f.follower_id,
    'new_coin',
    format('%s added a new coin: %s', v_username, NEW."Coin Name"),
    NEW.id,
    now(),
    false
  FROM followers f
  WHERE f.following_id = v_user_email
  AND f.follower_id != v_user_email;

  RETURN NEW;
END;
$$;

-- Recreate notify_followers trigger
DROP TRIGGER IF EXISTS notify_followers_trigger ON "Challenge Coin Table";
CREATE TRIGGER notify_followers_trigger
AFTER INSERT ON "Challenge Coin Table"
FOR EACH ROW
EXECUTE FUNCTION notify_followers();