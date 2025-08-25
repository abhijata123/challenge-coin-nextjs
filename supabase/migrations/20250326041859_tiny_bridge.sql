/*
  # Add leaderboard data structure and sample data

  1. Changes
    - Add Created At column to User Dps table if not exists
    - Add Last Sign In column to User Dps table if not exists
    - Update Number Of Coins calculation trigger
    - Add sample data for testing

  2. Security
    - No changes to RLS policies needed
*/

-- Add Created At column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'User Dps' AND column_name = 'Created At'
  ) THEN
    ALTER TABLE "User Dps"
    ADD COLUMN "Created At" timestamptz DEFAULT now();
  END IF;
END $$;

-- Add Last Sign In column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'User Dps' AND column_name = 'Last Sign In'
  ) THEN
    ALTER TABLE "User Dps"
    ADD COLUMN "Last Sign In" timestamptz DEFAULT now();
  END IF;
END $$;

-- Create or replace function to update coin count
CREATE OR REPLACE FUNCTION update_user_coin_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "User Dps"
  SET "Number Of Coins" = (
    SELECT COUNT(*)
    FROM "Challenge Coin Table"
    WHERE "Challenge Coin Table"."UserId" = NEW."UserId"
  )
  WHERE "User Dps"."id"::text = NEW."UserId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_coin_count_trigger'
  ) THEN
    CREATE TRIGGER update_coin_count_trigger
    AFTER INSERT OR DELETE ON "Challenge Coin Table"
    FOR EACH ROW
    EXECUTE FUNCTION update_user_coin_count();
  END IF;
END $$;

-- Update existing coin counts
UPDATE "User Dps" ud
SET "Number Of Coins" = (
  SELECT COUNT(*)
  FROM "Challenge Coin Table" cct
  WHERE cct."UserId" = ud.id::text
);

-- Update Last Sign In for existing users
UPDATE "User Dps"
SET "Last Sign In" = now()
WHERE "Last Sign In" IS NULL;

-- Update Created At for existing users
UPDATE "User Dps"
SET "Created At" = now() - (random() * interval '90 days')
WHERE "Created At" IS NULL;