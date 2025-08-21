/*
  # Fix username update functionality
  
  1. Changes
    - Update the update_username function to properly update all related tables
    - Ensure username changes are reflected in all coins and other related data
    - Add better error handling and transaction support
    
  2. Security
    - Maintain existing security model
*/

-- Improved function to update username across all tables
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
AS $$
DECLARE
  v_user_id text;
  v_transaction_successful boolean := false;
BEGIN
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
    -- Update User Dps table
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

    -- Update Challenge Coin Table
    UPDATE "Challenge Coin Table"
    SET "Username" = new_username
    WHERE "UserId" = user_email;

    -- Update Coin Forum
    UPDATE "Coin Forum"
    SET "Username" = array_replace("Username", old_username, new_username)
    WHERE old_username = ANY("Username");

    -- Update notifications metadata
    UPDATE notifications
    SET metadata = jsonb_set(
      metadata,
      '{username}',
      to_jsonb(new_username)
    )
    WHERE metadata->>'username' = old_username;

    -- Update notifications content
    UPDATE notifications
    SET content = regexp_replace(
      content,
      old_username,
      new_username,
      'g'
    )
    WHERE content LIKE '%' || old_username || '%';

    v_transaction_successful := true;
    
    RETURN 'success';
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback will happen automatically
      RETURN SQLERRM;
  END;
END;
$$;