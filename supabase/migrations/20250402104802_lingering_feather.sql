-- Drop existing function
DROP FUNCTION IF EXISTS update_username;

-- Create improved function to update username and related records
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
BEGIN
  -- Get user ID
  SELECT id::text INTO v_user_id
  FROM "User Dps"
  WHERE email = user_email;

  IF v_user_id IS NULL THEN
    RETURN 'User not found';
  END IF;

  -- Check if new username is already taken
  IF EXISTS (
    SELECT 1 
    FROM "User Dps" 
    WHERE "Username" = new_username 
    AND email != user_email
  ) THEN
    RETURN 'Username already taken';
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
    SET 
      "Username" = new_username,
      "UserId" = user_email
    WHERE "Username" = old_username;

    -- Update Coin Forum
    UPDATE "Coin Forum"
    SET "Username" = array_replace("Username", old_username, new_username)
    WHERE old_username = ANY("Username");

    -- Update notifications
    UPDATE notifications
    SET user_id = user_email
    WHERE user_id = user_email;

    -- Update followers
    UPDATE followers
    SET follower_id = user_email
    WHERE follower_id = user_email;

    UPDATE followers
    SET following_id = user_email
    WHERE following_id = user_email;

    RETURN 'success';
  EXCEPTION
    WHEN OTHERS THEN
      RETURN SQLERRM;
  END;
END;
$$;