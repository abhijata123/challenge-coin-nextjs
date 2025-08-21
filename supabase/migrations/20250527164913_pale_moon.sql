/*
  # Fix username update functionality
  
  1. Changes
    - Create a more efficient update_username function
    - Use proper batching techniques to avoid lock timeouts
    - Fix SQL syntax errors in previous implementation
    
  2. Security
    - Maintain existing security model
*/

-- Create improved function to update username with much longer timeout
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
SET statement_timeout = '1800s'  -- Increase timeout to 1800 seconds (30 minutes)
AS $$
DECLARE
  v_user_id text;
  v_batch_size integer := 100;
  v_updated_count integer := 0;
  v_total_updated integer := 0;
  v_offset integer := 0;
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

    -- Update Challenge Coin Table in batches
    v_offset := 0;
    LOOP
      WITH updated_rows AS (
        UPDATE "Challenge Coin Table"
        SET "Username" = new_username
        WHERE "UserId" = user_email
        AND id IN (
          SELECT id 
          FROM "Challenge Coin Table"
          WHERE "UserId" = user_email
          ORDER BY id
          OFFSET v_offset
          LIMIT v_batch_size
        )
        RETURNING 1
      )
      SELECT COUNT(*) INTO v_updated_count FROM updated_rows;
      
      v_total_updated := v_total_updated + v_updated_count;
      
      -- Log batch update progress
      RAISE NOTICE 'Updated batch of % coins, total updated: %', v_updated_count, v_total_updated;
      
      -- Move to next batch
      v_offset := v_offset + v_batch_size;
      
      -- Add a small delay between batches to reduce database load
      PERFORM pg_sleep(0.05);
      
      EXIT WHEN v_updated_count = 0;
    END LOOP;

    -- Update Coin Forum
    UPDATE "Coin Forum"
    SET "Username" = array_replace("Username", old_username, new_username)
    WHERE old_username = ANY("Username");

    -- Log the Coin Forum update
    RAISE NOTICE 'Updated Coin Forum for user %', user_email;

    -- Update notifications metadata
    v_offset := 0;
    v_total_updated := 0;
    LOOP
      WITH updated_rows AS (
        UPDATE notifications
        SET metadata = jsonb_set(
          metadata,
          '{username}',
          to_jsonb(new_username)
        )
        WHERE metadata->>'username' = old_username
        AND id IN (
          SELECT id 
          FROM notifications
          WHERE metadata->>'username' = old_username
          ORDER BY id
          OFFSET v_offset
          LIMIT v_batch_size
        )
        RETURNING 1
      )
      SELECT COUNT(*) INTO v_updated_count FROM updated_rows;
      
      v_total_updated := v_total_updated + v_updated_count;
      
      -- Log batch update progress
      RAISE NOTICE 'Updated batch of % username metadata, total updated: %', v_updated_count, v_total_updated;
      
      -- Move to next batch
      v_offset := v_offset + v_batch_size;
      
      -- Add a small delay between batches to reduce database load
      PERFORM pg_sleep(0.05);
      
      EXIT WHEN v_updated_count = 0;
    END LOOP;

    -- Update actor_username in metadata
    v_offset := 0;
    v_total_updated := 0;
    LOOP
      WITH updated_rows AS (
        UPDATE notifications
        SET metadata = jsonb_set(
          metadata,
          '{actor_username}',
          to_jsonb(new_username)
        )
        WHERE metadata->>'actor_username' = old_username
        AND id IN (
          SELECT id 
          FROM notifications
          WHERE metadata->>'actor_username' = old_username
          ORDER BY id
          OFFSET v_offset
          LIMIT v_batch_size
        )
        RETURNING 1
      )
      SELECT COUNT(*) INTO v_updated_count FROM updated_rows;
      
      v_total_updated := v_total_updated + v_updated_count;
      
      -- Log batch update progress
      RAISE NOTICE 'Updated batch of % actor_username metadata, total updated: %', v_updated_count, v_total_updated;
      
      -- Move to next batch
      v_offset := v_offset + v_batch_size;
      
      -- Add a small delay between batches to reduce database load
      PERFORM pg_sleep(0.05);
      
      EXIT WHEN v_updated_count = 0;
    END LOOP;

    -- Update notifications content
    v_offset := 0;
    v_total_updated := 0;
    LOOP
      WITH updated_rows AS (
        UPDATE notifications
        SET content = regexp_replace(
          content,
          old_username,
          new_username,
          'g'
        )
        WHERE content LIKE '%' || old_username || '%'
        AND id IN (
          SELECT id 
          FROM notifications
          WHERE content LIKE '%' || old_username || '%'
          ORDER BY id
          OFFSET v_offset
          LIMIT v_batch_size
        )
        RETURNING 1
      )
      SELECT COUNT(*) INTO v_updated_count FROM updated_rows;
      
      v_total_updated := v_total_updated + v_updated_count;
      
      -- Log batch update progress
      RAISE NOTICE 'Updated batch of % notification content, total updated: %', v_updated_count, v_total_updated;
      
      -- Move to next batch
      v_offset := v_offset + v_batch_size;
      
      -- Add a small delay between batches to reduce database load
      PERFORM pg_sleep(0.05);
      
      EXIT WHEN v_updated_count = 0;
    END LOOP;
    
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