/*
  # Fix coin count trigger and update existing counts

  1. Changes
    - Update the trigger function to correctly count coins
    - Add error handling for the trigger function
    - Update existing coin counts for all users
    - Add logging for debugging purposes

  2. Security
    - No changes to RLS policies needed
    - Function runs with security definer to ensure proper access
*/

-- Improve the coin count trigger function with better error handling
CREATE OR REPLACE FUNCTION update_user_coin_count()
RETURNS TRIGGER 
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  user_id text;
  new_count integer;
BEGIN
  -- Determine which user_id to use based on the operation
  user_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD."UserId"
    ELSE NEW."UserId"
  END;

  -- Get the new count
  SELECT COUNT(*)
  INTO new_count
  FROM "Challenge Coin Table"
  WHERE "UserId" = user_id;

  -- Update the user's coin count
  UPDATE "User Dps"
  SET "Number Of Coins" = new_count
  WHERE id::text = user_id;

  -- Return the appropriate record based on operation
  RETURN CASE
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in update_user_coin_count: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_coin_count_trigger ON "Challenge Coin Table";

-- Recreate the trigger to handle both INSERT and DELETE
CREATE TRIGGER update_coin_count_trigger
AFTER INSERT OR DELETE ON "Challenge Coin Table"
FOR EACH ROW
EXECUTE FUNCTION update_user_coin_count();

-- Update all existing coin counts to ensure accuracy
UPDATE "User Dps" ud
SET "Number Of Coins" = (
  SELECT COUNT(*)
  FROM "Challenge Coin Table" cct
  WHERE cct."UserId" = ud.id::text
);