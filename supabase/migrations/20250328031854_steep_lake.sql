/*
  # Update Mode of Acquiring field

  1. Changes
    - Update existing records to valid values
    - Add check constraint for Mode of Acquiring values
    - Ensure data consistency
    
  2. Security
    - No changes to RLS policies needed
*/

-- First, update existing records to valid values
UPDATE "Challenge Coin Table"
SET "Mode Of Acquiring" = 'self added'
WHERE "Mode Of Acquiring" NOT IN ('self added', 'gifted', 'Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Legendary')
OR "Mode Of Acquiring" IS NULL;

-- Now it's safe to add the constraint
DO $$ 
BEGIN
  -- Drop the constraint if it exists
  ALTER TABLE "Challenge Coin Table"
  DROP CONSTRAINT IF EXISTS mode_of_acquiring_check;

  -- Add the new constraint
  ALTER TABLE "Challenge Coin Table"
  ADD CONSTRAINT mode_of_acquiring_check
  CHECK ("Mode Of Acquiring" IN ('self added', 'gifted', 'Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Legendary'));
END $$;