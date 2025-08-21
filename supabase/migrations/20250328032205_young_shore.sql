/*
  # Separate rarity level and mode of acquiring

  1. Changes
    - Add new Rarity Level column
    - Update existing records
    - Add check constraint for Rarity Level
    
  2. Security
    - No changes to RLS policies needed
*/

-- Add Rarity Level column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Challenge Coin Table' 
    AND column_name = 'Rarity Level'
  ) THEN
    ALTER TABLE "Challenge Coin Table"
    ADD COLUMN "Rarity Level" text;
  END IF;
END $$;

-- Copy rarity values from Mode Of Acquiring to Rarity Level
UPDATE "Challenge Coin Table"
SET "Rarity Level" = "Mode Of Acquiring"
WHERE "Mode Of Acquiring" IN ('Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Legendary');

-- Update Mode Of Acquiring to correct values
UPDATE "Challenge Coin Table"
SET "Mode Of Acquiring" = 'self added'
WHERE "Mode Of Acquiring" IN ('Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Legendary');

-- Add check constraint for Rarity Level
DO $$ 
BEGIN
  ALTER TABLE "Challenge Coin Table"
  DROP CONSTRAINT IF EXISTS rarity_level_check;

  ALTER TABLE "Challenge Coin Table"
  ADD CONSTRAINT rarity_level_check
  CHECK ("Rarity Level" IN ('Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Legendary'));
END $$;

-- Update Mode Of Acquiring constraint
DO $$ 
BEGIN
  ALTER TABLE "Challenge Coin Table"
  DROP CONSTRAINT IF EXISTS mode_of_acquiring_check;

  ALTER TABLE "Challenge Coin Table"
  ADD CONSTRAINT mode_of_acquiring_check
  CHECK ("Mode Of Acquiring" IN ('self added', 'gifted'));
END $$;