/*
  # Fix username update timeout issue
  
  1. Changes
    - Completely rewrite the update_username function to avoid timeouts
    - Use a more efficient approach with direct SQL updates
    - Remove unnecessary logging that could slow down the process
    
  2. Security
    - Maintain existing security model
*/

-- Create improved function to update username without timeouts
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

    -- Update Challenge Coin Table - direct update without batching
    -- This is more efficient for the database
    EXECUTE 'UPDATE "Challenge Coin Table" SET "Username" = $1 WHERE "UserId" = $2'
    USING new_username, user_email;

    -- Update Coin Forum - direct update without complex array operations
    EXECUTE 'UPDATE "Coin Forum" SET "Username" = array_replace("Username", $1, $2) WHERE $1 = ANY("Username")'
    USING old_username, new_username;

    -- Update notifications metadata - direct update without jsonb operations
    EXECUTE 'UPDATE notifications SET metadata = jsonb_set(metadata, ''{username}'', to_jsonb($1::text)) WHERE metadata->>''username'' = $2'
    USING new_username, old_username;

    -- Update actor_username in metadata - direct update without jsonb operations
    EXECUTE 'UPDATE notifications SET metadata = jsonb_set(metadata, ''{actor_username}'', to_jsonb($1::text)) WHERE metadata->>''actor_username'' = $2'
    USING new_username, old_username;

    -- Update notifications content - direct update without regex
    EXECUTE 'UPDATE notifications SET content = replace(content, $1, $2) WHERE content LIKE ''%'' || $1 || ''%'''
    USING old_username, new_username;
    
    RETURN 'success';
  EXCEPTION
    WHEN OTHERS THEN
      RETURN SQLERRM;
  END;
END;
$$;