/*
  # Fix Has_Copyright column name
  
  1. Changes
    - Rename Has_Copyright column to "Has Copyright" to match code references
    - Update existing records
    
  2. Security
    - No changes to security policies needed
*/

-- Rename Has_Copyright column to "Has Copyright"
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Challenge Coin Table' AND column_name = 'Has_Copyright'
  ) THEN
    ALTER TABLE "Challenge Coin Table"
    RENAME COLUMN "Has_Copyright" TO "Has Copyright";
  END IF;
END $$;

-- If the column doesn't exist yet, create it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Challenge Coin Table' AND column_name = 'Has Copyright'
  ) THEN
    ALTER TABLE "Challenge Coin Table"
    ADD COLUMN "Has Copyright" boolean DEFAULT false;
  END IF;
END $$;

-- Update existing records to have default value if null
UPDATE "Challenge Coin Table"
SET "Has Copyright" = false
WHERE "Has Copyright" IS NULL;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';