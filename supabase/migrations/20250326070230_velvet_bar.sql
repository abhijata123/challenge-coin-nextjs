/*
  # Revert all recent database changes

  1. Changes
    - Remove all triggers and functions
    - Remove constraints
    - Simplify table structure
    - Reset to original state

  2. Security
    - Keep RLS disabled as it was originally
*/

-- Drop all recent triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_last_signin_trigger ON auth.users;
DROP TRIGGER IF EXISTS update_coin_count_trigger ON "Challenge Coin Table";

-- Drop all recent functions
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS update_last_signin();
DROP FUNCTION IF EXISTS update_user_coin_count();
DROP FUNCTION IF EXISTS get_active_users();

-- Remove constraints
ALTER TABLE "User Dps" DROP CONSTRAINT IF EXISTS user_dps_username_unique;
ALTER TABLE "User Dps" DROP CONSTRAINT IF EXISTS user_dps_email_unique;
ALTER TABLE "User Dps" DROP CONSTRAINT IF EXISTS theme_check;

-- Remove recently added columns
ALTER TABLE "User Dps" DROP COLUMN IF EXISTS "Created At";
ALTER TABLE "User Dps" DROP COLUMN IF EXISTS "Last Sign In";
ALTER TABLE "User Dps" DROP COLUMN IF EXISTS "Theme";

-- Ensure RLS is disabled (original state)
ALTER TABLE "User Dps" DISABLE ROW LEVEL SECURITY;

-- Drop any remaining policies
DROP POLICY IF EXISTS "Users can view their own profile" ON "User Dps";
DROP POLICY IF EXISTS "Users can update their own profile" ON "User Dps";