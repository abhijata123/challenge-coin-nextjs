/*
  # Add created_at column to Challenge Coin Table
  
  1. Changes
    - Add created_at column to Challenge Coin Table
    - Set default value to now()
    - Backfill existing records with current timestamp
    
  2. Security
    - No changes to security policies needed
*/

-- Add created_at column if it doesn't exist
ALTER TABLE "Challenge Coin Table"
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Update existing records to have a timestamp
UPDATE "Challenge Coin Table"
SET created_at = now()
WHERE created_at IS NULL;

-- Create index for faster sorting
CREATE INDEX IF NOT EXISTS idx_challenge_coin_created_at 
ON "Challenge Coin Table" (created_at DESC);