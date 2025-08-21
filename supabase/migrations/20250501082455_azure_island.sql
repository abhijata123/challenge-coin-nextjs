/*
  # Add created_at column and populate with auth data
  
  1. Changes
    - Add created_at column to User Dps table
    - Populate with signup dates from auth.users
    - Add default value for new users
    
  2. Security
    - Maintain existing security model
*/

-- Add created_at column if it doesn't exist
ALTER TABLE "User Dps"
ADD COLUMN IF NOT EXISTS "created_at" timestamptz;

-- Update existing users with their signup dates from auth.users
UPDATE "User Dps" ud
SET "created_at" = au.created_at
FROM auth.users au
WHERE ud.email = au.email;

-- Set default value for new users
ALTER TABLE "User Dps"
ALTER COLUMN "created_at" SET DEFAULT now();

-- Create index for faster sorting
CREATE INDEX IF NOT EXISTS idx_user_dps_created_at 
ON "User Dps" ("created_at" DESC);