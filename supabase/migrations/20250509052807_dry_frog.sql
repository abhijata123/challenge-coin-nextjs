/*
  # Add Has_Copyright column to Challenge Coin Table
  
  1. Changes
    - Add Has_Copyright column to Challenge Coin Table
    - Set default value to false
    - Update existing records
    
  2. Security
    - No changes to security policies needed
*/

-- Add Has_Copyright column if it doesn't exist
ALTER TABLE "Challenge Coin Table"
ADD COLUMN IF NOT EXISTS "Has_Copyright" boolean DEFAULT false;

-- Update existing records to have default value if null
UPDATE "Challenge Coin Table"
SET "Has_Copyright" = false
WHERE "Has_Copyright" IS NULL;