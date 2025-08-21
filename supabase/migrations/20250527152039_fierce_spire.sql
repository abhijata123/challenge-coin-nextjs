/*
  # Fix profile picture update timeout
  
  1. Changes
    - Increase statement timeout for update_username function to 10 minutes
    - Add detailed logging for debugging
    - Optimize the update operation
    
  2. Security
    - Maintain existing security model
*/

-- Create improved function to update username with longer timeout
CREATE OR REPLACE FUNCTION update_username(
  old_username text,
  new_username text,
  user_email text,
  new_bio text,
  new_status text,
  new_location text,
  new_picture text,
  new_share_dates boolean,
  new_share_notes boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '600s'  -- Increase timeout to 600 seconds (10 minutes)
AS $$
DECLARE
  v_user_id text;
  v_batch_size integer := 1000;
  v_updated_count integer := 0;
  v_total_updated integer := 0;
BEGIN
  -- Log the start of the update
  RAISE NOTICE 'Starting profile update for user % with new picture %', user_email, new_picture;

  -- Check if new username is already taken
  IF EXISTS (
    SELECT 1 
    FROM "User Dps" 
    WHERE "Username" = new_username 
    AND email != user_email
  ) THEN
    RETURN 'Username already taken';
  END IF;

  -- Get user ID
  SELECT id::text INTO v_user_id
  FROM "User Dps"
  WHERE email = user_email;

  IF v_user_id IS NULL THEN
    RETURN 'User not found';
  END IF;

  -- Start transaction
  BEGIN
    -- Update User Dps table first (most important)
    UPDATE "User Dps"
    SET 
      "Username" = new_username,
      "Bio" = new_bio,
      "Status" = new_status,
      "Location" = new_location,
      "piture link" = COALESCE(new_picture, "piture link"),
      "Share_Dates" = new_share_dates,
      "Share_Notes" = new_share_notes
    WHERE email = user_email;

    -- Log the User Dps update
    RAISE NOTICE 'Updated User Dps table for user % with new picture %', user_email, new_picture;

    -- Update Challenge Coin Table in batches using a loop
    LOOP
      WITH updated_rows AS (
        UPDATE "Challenge Coin Table"
        SET "Username" = new_username
        WHERE "UserId" = user_email 
        AND "Username" = old_username
        AND id IN (
          SELECT id 
          FROM "Challenge Coin Table"
          WHERE "UserId" = user_email 
          AND "Username" = old_username
          ORDER BY id
          LIMIT v_batch_size
        )
        RETURNING 1
      )
      SELECT COUNT(*) INTO v_updated_count FROM updated_rows;
      
      v_total_updated := v_total_updated + v_updated_count;
      
      -- Log batch update progress
      RAISE NOTICE 'Updated batch of % coins, total updated: %', v_updated_count, v_total_updated;
      
      EXIT WHEN v_updated_count = 0;
    END LOOP;

    -- Update Coin Forum
    UPDATE "Coin Forum"
    SET "Username" = array_replace("Username", old_username, new_username)
    WHERE old_username = ANY("Username");

    -- Log the Coin Forum update
    RAISE NOTICE 'Updated Coin Forum for user %', user_email;

    -- Update notifications metadata
    UPDATE notifications
    SET metadata = jsonb_set(
      metadata,
      '{username}',
      to_jsonb(new_username)
    )
    WHERE metadata->>'username' = old_username;

    -- Log the notifications metadata update
    RAISE NOTICE 'Updated notifications metadata for user %', user_email;

    -- Update notifications content
    UPDATE notifications
    SET content = regexp_replace(
      content,
      old_username,
      new_username,
      'g'
    )
    WHERE content LIKE '%' || old_username || '%';

    -- Log the notifications content update
    RAISE NOTICE 'Updated notifications content for user %', user_email;
    
    -- Log completion
    RAISE NOTICE 'Profile update completed successfully for user %', user_email;
    
    RETURN 'success';
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error
      RAISE NOTICE 'Error updating profile for user %: %', user_email, SQLERRM;
      -- Rollback will happen automatically
      RETURN SQLERRM;
  END;
END;
$$;