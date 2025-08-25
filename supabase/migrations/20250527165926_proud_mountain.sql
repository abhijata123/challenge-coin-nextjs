-- Create improved function to update username with simpler batching approach
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
SET statement_timeout = '1800s'  -- 30 minutes timeout
AS $$
DECLARE
  v_user_id text;
  v_batch_size integer := 100;
  v_updated_count integer := 0;
  v_total_updated integer := 0;
BEGIN
  -- Log the start of the update
  RAISE NOTICE 'Starting profile update for user % with new username % (old: %)', 
    user_email, new_username, old_username;

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
      "piture link" = CASE 
                        WHEN new_picture IS NOT NULL AND new_picture != '' 
                        THEN new_picture 
                        ELSE "piture link" 
                      END,
      "Share_Dates" = new_share_dates,
      "Share_Notes" = new_share_notes
    WHERE email = user_email;

    -- Log the User Dps update
    RAISE NOTICE 'Updated User Dps table for user % with new username %', user_email, new_username;

    -- Update Challenge Coin Table all at once
    UPDATE "Challenge Coin Table"
    SET "Username" = new_username
    WHERE "UserId" = user_email;

    -- Log the Challenge Coin Table update
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % coins for user %', v_updated_count, user_email;

    -- Update Coin Forum
    UPDATE "Coin Forum"
    SET "Username" = array_replace("Username", old_username, new_username)
    WHERE old_username = ANY("Username");

    -- Log the Coin Forum update
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % Coin Forum entries for user %', v_updated_count, user_email;

    -- Update notifications metadata
    UPDATE notifications
    SET metadata = jsonb_set(
      metadata,
      '{username}',
      to_jsonb(new_username)
    )
    WHERE metadata->>'username' = old_username;

    -- Log the notifications metadata update
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % username metadata entries', v_updated_count;

    -- Update actor_username in metadata
    UPDATE notifications
    SET metadata = jsonb_set(
      metadata,
      '{actor_username}',
      to_jsonb(new_username)
    )
    WHERE metadata->>'actor_username' = old_username;

    -- Log the actor_username metadata update
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % actor_username metadata entries', v_updated_count;

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
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % notification content entries', v_updated_count;
    
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