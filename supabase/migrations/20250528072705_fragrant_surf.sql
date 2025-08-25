/*
  # Fix username update to properly handle coin UserId
  
  1. Changes
    - Update the update_username function to properly update UserId in Challenge Coin Table
    - Fix issue with coins not being fetched after username change
    - Ensure all coins are properly associated with the user after username change
    
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
SET statement_timeout = '3600s'  -- Increase timeout to 3600 seconds (60 minutes)
AS $$
DECLARE
  v_user_id text;
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

    -- Update Challenge Coin Table - update both Username AND UserId
    -- This ensures all coins are properly associated with the user
    EXECUTE 'UPDATE "Challenge Coin Table" SET "Username" = $1, "UserId" = $2 WHERE "Username" = $3 OR "UserId" = $2'
    USING new_username, user_email, old_username;

    -- Update Coin Forum - direct update
    EXECUTE 'UPDATE "Coin Forum" SET "Username" = array_replace("Username", $1, $2) WHERE $1 = ANY("Username")'
    USING old_username, new_username;

    -- Update notifications metadata - direct update
    EXECUTE 'UPDATE notifications SET metadata = jsonb_set(metadata, ''{username}'', to_jsonb($1::text)) WHERE metadata->>''username'' = $2'
    USING new_username, old_username;

    -- Update actor_username in metadata - direct update
    EXECUTE 'UPDATE notifications SET metadata = jsonb_set(metadata, ''{actor_username}'', to_jsonb($1::text)) WHERE metadata->>''actor_username'' = $2'
    USING new_username, old_username;

    -- Update notifications content - direct update
    EXECUTE 'UPDATE notifications SET content = replace(content, $1, $2) WHERE content LIKE ''%'' || $1 || ''%'''
    USING old_username, new_username;
    
    RETURN 'success';
  EXCEPTION
    WHEN OTHERS THEN
      RETURN SQLERRM;
  END;
END;
$$;