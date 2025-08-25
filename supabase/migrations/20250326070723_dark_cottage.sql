/*
  # Clean up User Profile Security and Data

  1. Changes
    - Disable RLS on User Dps table
    - Remove existing policies
    - Drop unused triggers and functions
    - Clean up constraints
    - Reset data to default values
    
  2. Security
    - Removes all RLS policies
    - Disables RLS completely
    
  3. Data Handling
    - Resets profile data to default values
    - Maintains data integrity
*/

-- Disable RLS on User Dps table
ALTER TABLE "User Dps" DISABLE ROW LEVEL SECURITY;

-- Drop policies if they exist
DO $$ 
BEGIN
  -- Attempt to drop each policy individually with error handling
  BEGIN
    DROP POLICY IF EXISTS "Users can view their own profile" ON "User Dps";
  EXCEPTION WHEN OTHERS THEN
    -- Policy might not exist, continue
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can update their own profile" ON "User Dps";
  EXCEPTION WHEN OTHERS THEN
    -- Policy might not exist, continue
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Security Policy" ON "User Dps";
  EXCEPTION WHEN OTHERS THEN
    -- Policy might not exist, continue
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "User Dps Policy" ON "User Dps";
  EXCEPTION WHEN OTHERS THEN
    -- Policy might not exist, continue
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can insert their own profile" ON "User Dps";
  EXCEPTION WHEN OTHERS THEN
    -- Policy might not exist, continue
  END;
END $$;

-- Drop triggers with error handling
DO $$ 
BEGIN
  -- Attempt to drop each trigger individually
  BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  EXCEPTION WHEN OTHERS THEN
    -- Trigger might not exist, continue
  END;
  
  BEGIN
    DROP TRIGGER IF EXISTS update_last_signin_trigger ON auth.users;
  EXCEPTION WHEN OTHERS THEN
    -- Trigger might not exist, continue
  END;
  
  BEGIN
    DROP TRIGGER IF EXISTS update_coin_count_trigger ON "Challenge Coin Table";
  EXCEPTION WHEN OTHERS THEN
    -- Trigger might not exist, continue
  END;
END $$;

-- Drop functions with error handling
DO $$ 
BEGIN
  -- Attempt to drop each function individually
  BEGIN
    DROP FUNCTION IF EXISTS handle_new_user();
  EXCEPTION WHEN OTHERS THEN
    -- Function might not exist, continue
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS update_last_signin();
  EXCEPTION WHEN OTHERS THEN
    -- Function might not exist, continue
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS update_user_coin_count();
  EXCEPTION WHEN OTHERS THEN
    -- Function might not exist, continue
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS get_active_users();
  EXCEPTION WHEN OTHERS THEN
    -- Function might not exist, continue
  END;
END $$;

-- Drop constraints with error handling
DO $$ 
BEGIN
  -- Attempt to drop each constraint individually
  BEGIN
    ALTER TABLE "User Dps" DROP CONSTRAINT IF EXISTS "User Dps_Username_key";
  EXCEPTION WHEN OTHERS THEN
    -- Constraint might not exist, continue
  END;
  
  BEGIN
    ALTER TABLE "User Dps" DROP CONSTRAINT IF EXISTS "User Dps_email_key";
  EXCEPTION WHEN OTHERS THEN
    -- Constraint might not exist, continue
  END;
END $$;

-- Reset data to default values
UPDATE "User Dps"
SET 
  "Bio" = COALESCE("Bio", ''),
  "Number Of Coins" = COALESCE("Number Of Coins", 0),
  "PicUploaded" = COALESCE("PicUploaded", false),
  "Share_Dates" = COALESCE("Share_Dates", false),
  "Share_Notes" = COALESCE("Share_Notes", false)
WHERE TRUE;