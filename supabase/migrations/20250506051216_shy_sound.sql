/*
  # Add public coin forum notifications
  
  1. Changes
    - Add function to notify users when coins are added to the forum
    - Update notifications table to support public_coin type
    - Ensure all users get notified of new public coins
    
  2. Security
    - Maintain existing security model
*/

-- Update notifications type check to include public_coin if not already done
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

-- Add updated constraint with public_coin type
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
  v_user_email text;
BEGIN
  -- Only trigger when Public Display changes from false to true
  IF OLD."Public Display" = false AND NEW."Public Display" = true THEN
    -- Get user email and username
    v_user_email := NEW."UserId";
    v_username := NEW."Username";
    
    -- Create notifications for ALL users (not just followers)
    INSERT INTO notifications (
      recipient_id,
      type,
      content,
      reference_id,
      reference_type,
      metadata
    )
    SELECT 
      ud.email,
      'public_coin',
      format('%s added a new coin to the forum: %s', v_username, NEW."Coin Name"),
      NEW.id::text,
      'coin',
      jsonb_build_object(
        'coin_name', NEW."Coin Name",
        'coin_image', NEW."Coin Image",
        'date_issued', NEW."Date Issued",
        'username', v_username,
        'user_id', v_user_email,
        'public_url', format('/collection/%s/coin/%s', v_username, NEW.id),
        'is_public', true,
        'made_public_at', now()
      )
    FROM "User Dps" ud
    WHERE ud.email != v_user_email;
    
    -- Create a notification for the user themselves
    INSERT INTO notifications (
      recipient_id,
      type,
      content,
      reference_id,
      reference_type,
      metadata
    )
    VALUES (
      v_user_email,
      'public_coin',
      format('You added a coin to the forum: %s', NEW."Coin Name"),
      NEW.id::text,
      'coin',
      jsonb_build_object(
        'coin_name', NEW."Coin Name",
        'coin_image', NEW."Coin Image",
        'date_issued', NEW."Date Issued",
        'username', v_username,
        'user_id', v_user_email,
        'public_url', format('/collection/%s/coin/%s', v_username, NEW.id),
        'is_public', true,
        'made_public_at', now()
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in notify_public_coin: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate trigger for public coin notifications
DROP TRIGGER IF EXISTS notify_public_coin_trigger ON "Challenge Coin Table";
CREATE TRIGGER notify_public_coin_trigger
AFTER UPDATE ON "Challenge Coin Table"
FOR EACH ROW
EXECUTE FUNCTION notify_public_coin();