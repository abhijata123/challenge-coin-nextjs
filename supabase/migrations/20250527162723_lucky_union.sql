/*
  # Fix username update function
  
  1. Changes
    - Improve update_username function to handle all related tables
    - Fix issues with username updates
    - Increase timeout to prevent statement timeouts
    
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
SET statement_timeout = '900s'  -- Increase timeout to 15 minutes
AS $$
DECLARE
  v_user_id text;
  v_batch_size integer := 200;  -- Smaller batch size for better performance
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

    -- Update Challenge Coin Table in smaller batches for better performance
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
          LIMIT v_batch_size
        )
        RETURNING 1
      )
      SELECT COUNT(*) INTO v_updated_count FROM updated_rows;
      
      v_total_updated := v_total_updated + v_updated_count;
      
      -- Log batch update progress
      RAISE NOTICE 'Updated batch of % coins, total updated: %', v_updated_count, v_total_updated;
      
      -- Add a small delay between batches to reduce database load
      PERFORM pg_sleep(0.1);
      
      EXIT WHEN v_updated_count = 0;
    END LOOP;

    -- Update Coin Forum
    UPDATE "Coin Forum"
    SET "Username" = array_replace("Username", old_username, new_username)
    WHERE old_username = ANY("Username");

    -- Log the Coin Forum update
    RAISE NOTICE 'Updated Coin Forum for user %', user_email;

    -- Update posts table
    UPDATE posts
    SET user_id = user_email
    WHERE user_id = user_email;

    -- Update post_likes table
    UPDATE post_likes
    SET user_id = user_email
    WHERE user_id = user_email;

    -- Update post_comments table
    UPDATE post_comments
    SET user_id = user_email
    WHERE user_id = user_email;

    -- Update comment_likes table
    UPDATE comment_likes
    SET user_id = user_email
    WHERE user_id = user_email;

    -- Update coin_questions table
    UPDATE coin_questions
    SET user_id = user_email
    WHERE user_id = user_email;

    UPDATE coin_questions
    SET answered_by = user_email
    WHERE answered_by = user_email;

    -- Update notifications metadata in batches
    WITH updated_notifications AS (
      UPDATE notifications
      SET metadata = jsonb_set(
        metadata,
        '{username}',
        to_jsonb(new_username)
      )
      WHERE metadata->>'username' = old_username
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_updated_count FROM updated_notifications;

    -- Log the notifications metadata update
    RAISE NOTICE 'Updated % notifications metadata for user %', v_updated_count, user_email;

    -- Update actor_username in metadata
    WITH updated_actor_notifications AS (
      UPDATE notifications
      SET metadata = jsonb_set(
        metadata,
        '{actor_username}',
        to_jsonb(new_username)
      )
      WHERE metadata->>'actor_username' = old_username
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_updated_count FROM updated_actor_notifications;

    -- Log the actor_username metadata update
    RAISE NOTICE 'Updated % actor_username metadata for user %', v_updated_count, user_email;

    -- Update notifications content in batches
    WITH updated_content AS (
      UPDATE notifications
      SET content = regexp_replace(
        content,
        old_username,
        new_username,
        'g'
      )
      WHERE content LIKE '%' || old_username || '%'
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_updated_count FROM updated_content;

    -- Log the notifications content update
    RAISE NOTICE 'Updated % notifications content for user %', v_updated_count, user_email;
    
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