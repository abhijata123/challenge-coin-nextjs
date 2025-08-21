/*
  # Fix Has_Copyright column
  
  1. Changes
    - Add Has_Copyright column to Challenge Coin Table
    - Set default value to false
    - Update existing records
    
  2. Security
    - No changes to security policies needed
*/

-- Add Has_Copyright column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Challenge Coin Table' AND column_name = 'Has_Copyright'
  ) THEN
    ALTER TABLE "Challenge Coin Table"
    ADD COLUMN "Has_Copyright" boolean DEFAULT false;
  END IF;
END $$;

-- Update existing records to have default value if null
UPDATE "Challenge Coin Table"
SET "Has_Copyright" = false
WHERE "Has_Copyright" IS NULL;