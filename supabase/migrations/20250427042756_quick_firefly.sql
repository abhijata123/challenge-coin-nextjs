/*
  # Remove Mode Of Acquiring constraint
  
  1. Changes
    - Drop existing constraint on Mode Of Acquiring
    - Allow any value for the field
    
  2. Security
    - No changes to security policies needed
*/

-- Drop the mode_of_acquiring_check constraint
DO $$ 
BEGIN
  ALTER TABLE "Challenge Coin Table"
  DROP CONSTRAINT IF EXISTS mode_of_acquiring_check;
END $$;