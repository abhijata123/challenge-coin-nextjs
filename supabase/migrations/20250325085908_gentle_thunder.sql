/*
  # Add theme column to User Dps table

  1. Changes
    - Add Theme column to User Dps table with default value 'default'
    - Make Theme column nullable
    - Add check constraint to ensure valid theme values

  2. Security
    - No changes to RLS policies needed
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'User Dps' AND column_name = 'Theme'
  ) THEN
    ALTER TABLE "User Dps"
    ADD COLUMN "Theme" text DEFAULT 'default';

    ALTER TABLE "User Dps"
    ADD CONSTRAINT theme_check 
    CHECK ("Theme" IN ('default', 'us-flag', 'army', 'navy', 'airforce', 'police', 'firefighting'));
  END IF;
END $$;