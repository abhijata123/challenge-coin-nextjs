/*
  # Fix username update timeout
  
  1. Changes
    - Increase statement timeout for update_username function to 30 minutes
    - Implement more efficient batching strategy using ID ranges
    - Add better error handling and logging
    
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
  v_batch_size integer := 100;  -- Smaller batch size for better performance
  v_updated_count integer := 0;
  v_total_updated integer := 0;
  v_max_id bigint;
  v_min_id bigint;
  v_current_min_id bigint;
  v_notification_batch_size integer := 500;
  v_notification_offset integer := 0;
  v_notification_count integer := 0;
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

    -- Get min and max IDs for more efficient batching
    SELECT MIN(id), MAX(id) INTO v_min_id, v_max_id
    FROM "Challenge Coin Table"
    WHERE "UserId" = user_email;

    -- Log the ID range
    RAISE NOTICE 'Coin ID range: % to %', v_min_id, v_max_id;

    -- If there are no coins, skip this part
    IF v_min_id IS NOT NULL AND v_max_id IS NOT NULL THEN
      -- Update Challenge Coin Table in smaller batches using ID ranges
      v_current_min_id := v_min_id;
      
      WHILE v_current_min_id <= v_max_id LOOP
        WITH updated_rows AS (
          UPDATE "Challenge Coin Table"
          SET "Username" = new_username
          WHERE "UserId" = user_email
          AND id >= v_current_min_id
          AND id < v_current_min_id + v_batch_size
          RETURNING 1
        )
        SELECT COUNT(*) INTO v_updated_count FROM updated_rows;
        
        v_total_updated := v_total_updated + v_updated_count;
        
        -- Log batch update progress
        RAISE NOTICE 'Updated coins from ID % to %, count: %, total: %', 
          v_current_min_id, v_current_min_id + v_batch_size - 1, v_updated_count, v_total_updated;
        
        -- Move to next batch
        v_current_min_id := v_current_min_id + v_batch_size;
        
        -- Add a small delay between batches to reduce database load
        PERFORM pg_sleep(0.05);
      END LOOP;
    END IF;

    -- Update Coin Forum with a more efficient query
    WITH updated_forum AS (
      UPDATE "Coin Forum"
      SET "Username" = array_replace("Username", old_username, new_username)
      WHERE old_username = ANY("Username")
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_updated_count FROM updated_forum;

    -- Log the Coin Forum update
    RAISE NOTICE 'Updated % Coin Forum entries for user %', v_updated_count, user_email;

    -- Update notifications metadata in batches using offset pagination
    v_notification_offset := 0;
    v_notification_count := 0;
    
    LOOP
      v_updated_count := 0;
      
      FOR i IN 1..v_notification_batch_size LOOP
        UPDATE notifications
        SET metadata = jsonb_set(
          metadata,
          '{username}',
          to_jsonb(new_username)
        )
        WHERE id = (
          SELECT id FROM notifications
          WHERE metadata->>'username' = old_username
          ORDER BY id
          OFFSET v_notification_offset
          LIMIT 1
        )
        RETURNING 1 INTO v_updated_count;
        
        IF v_updated_count = 0 THEN
          EXIT;
        END IF;
        
        v_notification_count := v_notification_count + 1;
        v_notification_offset := v_notification_offset + 1;
      END LOOP;
      
      -- Log progress
      RAISE NOTICE 'Updated % notifications metadata, total: %', 
        v_notification_batch_size, v_notification_count;
      
      -- Add a small delay between batches
      PERFORM pg_sleep(0.05);
      
      EXIT WHEN v_updated_count = 0;
    END LOOP;

    -- Update actor_username in metadata using the same approach
    v_notification_offset := 0;
    v_notification_count := 0;
    
    LOOP
      v_updated_count := 0;
      
      FOR i IN 1..v_notification_batch_size LOOP
        UPDATE notifications
        SET metadata = jsonb_set(
          metadata,
          '{actor_username}',
          to_jsonb(new_username)
        )
        WHERE id = (
          SELECT id FROM notifications
          WHERE metadata->>'actor_username' = old_username
          ORDER BY id
          OFFSET v_notification_offset
          LIMIT 1
        )
        RETURNING 1 INTO v_updated_count;
        
        IF v_updated_count = 0 THEN
          EXIT;
        END IF;
        
        v_notification_count := v_notification_count + 1;
        v_notification_offset := v_notification_offset + 1;
      END LOOP;
      
      -- Log progress
      RAISE NOTICE 'Updated % actor_username metadata, total: %', 
        v_notification_batch_size, v_notification_count;
      
      -- Add a small delay between batches
      PERFORM pg_sleep(0.05);
      
      EXIT WHEN v_updated_count = 0;
    END LOOP;

    -- Update notifications content using the same approach
    v_notification_offset := 0;
    v_notification_count := 0;
    
    LOOP
      v_updated_count := 0;
      
      FOR i IN 1..v_notification_batch_size LOOP
        UPDATE notifications
        SET content = regexp_replace(
          content,
          old_username,
          new_username,
          'g'
        )
        WHERE id = (
          SELECT id FROM notifications
          WHERE content LIKE '%' || old_username || '%'
          ORDER BY id
          OFFSET v_notification_offset
          LIMIT 1
        )
        RETURNING 1 INTO v_updated_count;
        
        IF v_updated_count = 0 THEN
          EXIT;
        END IF;
        
        v_notification_count := v_notification_count + 1;
        v_notification_offset := v_notification_offset + 1;
      END LOOP;
      
      -- Log progress
      RAISE NOTICE 'Updated % notification content, total: %', 
        v_notification_batch_size, v_notification_count;
      
      -- Add a small delay between batches
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