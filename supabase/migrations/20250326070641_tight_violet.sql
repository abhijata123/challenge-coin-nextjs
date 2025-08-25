/*
  # Synchronize User Profiles

  1. Changes
    - Create missing profiles for auth users
    - Ensure all users have usernames
    - Set default values for required fields
    
  2. Data Handling
    - Safely handles UUID to bigint conversion
    - Sets appropriate default values
    - Maintains data integrity
*/

-- Create missing profiles for existing auth users using a safer approach
WITH numbered_users AS (
  SELECT 
    au.id,
    au.email,
    au.raw_user_meta_data->>'username' as username,
    ROW_NUMBER() OVER (ORDER BY au.created_at) as row_num
  FROM auth.users au
  LEFT JOIN "User Dps" ud ON ud.email = au.email
  WHERE ud.id IS NULL
)
INSERT INTO "User Dps" (id, email, "Username", "Bio", "Number Of Coins", "Share_Dates", "Share_Notes")
SELECT 
  row_num + COALESCE((SELECT MAX(id) FROM "User Dps"), 0),
  email,
  COALESCE(username, email),
  '',
  0,
  false,
  false
FROM numbered_users;

-- Ensure all existing users have a username
UPDATE "User Dps"
SET "Username" = email
WHERE "Username" IS NULL;

-- Set default values for required fields
UPDATE "User Dps"
SET 
  "Bio" = COALESCE("Bio", ''),
  "Number Of Coins" = COALESCE("Number Of Coins", 0),
  "Share_Dates" = COALESCE("Share_Dates", false),
  "Share_Notes" = COALESCE("Share_Notes", false)
WHERE TRUE;