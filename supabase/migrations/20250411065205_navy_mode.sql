/*
  # Add auth_id column to User Dps table
  
  1. Changes
    - Add auth_id column to store Supabase auth ID
    - Update existing records with auth IDs
    
  2. Security
    - No changes to RLS policies needed
*/

-- Add auth_id column if it doesn't exist
ALTER TABLE "User Dps"
ADD COLUMN IF NOT EXISTS auth_id text;

-- Create unique constraint on auth_id
ALTER TABLE "User Dps"
ADD CONSTRAINT user_dps_auth_id_key UNIQUE (auth_id);