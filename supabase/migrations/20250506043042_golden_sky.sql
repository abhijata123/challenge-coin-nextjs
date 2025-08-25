/*
  # Add notifications for public coin uploads
  
  1. Changes
    - Add trigger to notify followers when a coin is made public
    - Update notification types to include public coin notifications
    - Add metadata for better notification display
    
  2. Security
    - Maintain existing security model
*/

-- Update notifications table to allow new notification type
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE notifications
    DROP CONSTRAINT notifications_type_check;
  END IF;
END $$;

-- Add updated constraint with new notification type
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN ('new_event', 'new_coin', 'post_like', 'post_comment', 'new_post', 'comment_like', 'public_coin'));

-- Function to create notification when a coin is made public
CREATE OR REPLACE FUNCTION notify_public_coin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username text;
  v_share_dates boolean;
  v_share_notes boolean;
BEGIN
  -- Only trigger when Public Display changes from false to true
  IF OLD."Public Display" = false AND NEW."Public Display" = true THEN
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
      'public_coin',
      format('%s made a coin public: %s', v_username, NEW."Coin Name"),
      NEW.id::text,
      'coin',
      jsonb_build_object(
        'coin_name', NEW."Coin Name",
        'coin_image', NEW."Coin Image",
        'date_issued', NEW."Date Issued",
        'username', v_username,
        'user_id', NEW."UserId",
        'public_url', format('/collection/%s/coin/%s', v_username, NEW.id),
        'is_public', true,
        'share_dates', v_share_dates,
        'share_notes', v_share_notes,
        'made_public_at', now()
      )
    FROM followers f
    WHERE f.following_id = NEW."UserId"
    AND f.follower_id != NEW."UserId";
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for public coin notifications
DROP TRIGGER IF EXISTS notify_public_coin_trigger ON "Challenge Coin Table";
CREATE TRIGGER notify_public_coin_trigger
AFTER UPDATE ON "Challenge Coin Table"
FOR EACH ROW
EXECUTE FUNCTION notify_public_coin();