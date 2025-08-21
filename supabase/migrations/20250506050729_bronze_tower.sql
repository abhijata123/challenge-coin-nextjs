/*
  # Fix public coin notifications
  
  1. Changes
    - Update notify_public_coin function to properly notify followers
    - Add debug logging to track notification creation
    - Ensure notifications are created for all followers
    
  2. Security
    - Maintain existing security model
*/

-- Update function to create notification when a coin is made public
CREATE OR REPLACE FUNCTION notify_public_coin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username text;
  v_user_email text;
  v_share_dates boolean;
  v_share_notes boolean;
  v_follower_count integer := 0;
BEGIN
  -- Only trigger when Public Display changes from false to true
  IF OLD."Public Display" = false AND NEW."Public Display" = true THEN
    -- Get user email from UserId
    v_user_email := NEW."UserId";
    
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
    WHERE email = v_user_email;

    -- Log for debugging
    RAISE NOTICE 'Creating public coin notifications for coin % by user % (email: %)', 
      NEW."Coin Name", v_username, v_user_email;

    -- Create notifications for followers using email-based relationship
    WITH inserted_notifications AS (
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
          'user_id', v_user_email,
          'public_url', format('/collection/%s/coin/%s', v_username, NEW.id),
          'is_public', true,
          'share_dates', v_share_dates,
          'share_notes', v_share_notes,
          'made_public_at', now()
        )
      FROM followers f
      WHERE f.following_id = v_user_email
      AND f.follower_id != v_user_email
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_follower_count FROM inserted_notifications;
    
    RAISE NOTICE 'Created % notifications for followers', v_follower_count;
    
    -- Also create a notification for the user themselves
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
      format('You made a coin public: %s', NEW."Coin Name"),
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
        'share_dates', v_share_dates,
        'share_notes', v_share_notes,
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