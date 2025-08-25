/*
  # Add function to update username across all tables
  
  1. Changes
    - Create function to update username in all related tables
    - Handle updates in User Dps, Challenge Coin Table, and other tables
    - Maintain data consistency across the database
    
  2. Security
    - Function runs with security definer to ensure proper access
*/

-- Create function to update username across all tables
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
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update User Dps table
  UPDATE "User Dps"
  SET 
    "Username" = new_username,
    "Bio" = new_bio,
    "Status" = new_status,
    "Location" = new_location,
    "piture link" = new_picture,
    "Share_Dates" = new_share_dates,
    "Share_Notes" = new_share_notes
  WHERE email = user_email;

  -- Update Challenge Coin Table
  UPDATE "Challenge Coin Table"
  SET "Username" = new_username
  WHERE "Username" = old_username;

  -- Update Coin Forum
  UPDATE "Coin Forum"
  SET "Username" = array_replace("Username", old_username, new_username)
  WHERE old_username = ANY("Username");

  -- Update posts
  UPDATE posts
  SET user_id = user_email
  WHERE user_id = user_email;

  -- Update post_likes
  UPDATE post_likes
  SET user_id = user_email
  WHERE user_id = user_email;

  -- Update post_comments
  UPDATE post_comments
  SET user_id = user_email
  WHERE user_id = user_email;
END;
$$;