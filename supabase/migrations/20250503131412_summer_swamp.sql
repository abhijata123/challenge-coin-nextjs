/*
  # Fix coin sharing preferences functionality
  
  1. Changes
    - Ensure Share_Dates and Share_Notes columns exist in User Dps table
    - Set default values for sharing preferences
    - Update reference_type constraint in notifications table
    
  2. Security
    - Maintain existing security model
*/

-- Ensure Share_Dates and Share_Notes columns exist with proper defaults
DO $$ 
BEGIN
  -- Add Share_Dates column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'User Dps' AND column_name = 'Share_Dates'
  ) THEN
    ALTER TABLE "User Dps"
    ADD COLUMN "Share_Dates" boolean DEFAULT false;
  END IF;

  -- Add Share_Notes column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'User Dps' AND column_name = 'Share_Notes'
  ) THEN
    ALTER TABLE "User Dps"
    ADD COLUMN "Share_Notes" boolean DEFAULT false;
  END IF;
END $$;

-- Update existing users to have default values if null
UPDATE "User Dps"
SET 
  "Share_Dates" = COALESCE("Share_Dates", false),
  "Share_Notes" = COALESCE("Share_Notes", false)
WHERE "Share_Dates" IS NULL OR "Share_Notes" IS NULL;

-- Update notifications reference_type constraint to include 'coin'
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notifications_reference_type_check'
  ) THEN
    ALTER TABLE notifications
    DROP CONSTRAINT notifications_reference_type_check;
  END IF;
END $$;

-- Add updated constraint
ALTER TABLE notifications
ADD CONSTRAINT notifications_reference_type_check
CHECK (reference_type IN ('event', 'coin', 'post', 'comment'));

-- Update coin notification function to include sharing preferences
CREATE OR REPLACE FUNCTION create_coin_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username text;
  v_share_dates boolean;
  v_share_notes boolean;
BEGIN
  -- Get username and sharing preferences
  SELECT 
    "Username", 
    "Share_Dates", 
    "Share_Notes"
  INTO 
    v_username,
    v_share_dates,
    v_share_notes
  FROM "User Dps"
  WHERE email = NEW."UserId";

  -- Create notifications for followers
  INSERT INTO notifications (
    recipient_id,
    type,
    content,
    reference_id,
    reference_type,
    metadata
  )
  SELECT 
    f.follower_id,
    'new_coin',
    format('%s added a new coin: %s', v_username, NEW."Coin Name"),
    NEW.id::text,
    'coin',
    jsonb_build_object(
      'coin_name', NEW."Coin Name",
      'coin_image', NEW."Coin Image",
      'date_issued', NEW."Date Issued",
      'username', v_username,
      'user_id', NEW."UserId",
      'public_url', format('/collection/%s/coin/%s', v_username, NEW.id),
      'is_public', NEW."Public Display",
      'share_dates', v_share_dates,
      'share_notes', v_share_notes
    )
  FROM followers f
  WHERE f.following_id = NEW."UserId"
  AND f.follower_id != NEW."UserId";

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS create_coin_notification_trigger ON "Challenge Coin Table";
CREATE TRIGGER create_coin_notification_trigger
AFTER INSERT ON "Challenge Coin Table"
FOR EACH ROW
EXECUTE FUNCTION create_coin_notification();