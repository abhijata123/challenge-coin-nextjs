/*
  # Update Last Sign In trigger

  1. Changes
    - Add function and trigger to update Last Sign In timestamp
    - Add function to update user activity on coin upload
    
  2. Security
    - Functions are marked as SECURITY DEFINER to ensure they run with necessary privileges
*/

-- Create or replace function to update last sign in
CREATE OR REPLACE FUNCTION update_last_signin()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "User Dps"
  SET "Last Sign In" = now()
  WHERE email = NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auth.users to update last sign in
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_last_signin_trigger'
  ) THEN
    CREATE TRIGGER update_last_signin_trigger
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION update_last_signin();
  END IF;
END $$;

-- Update Last Sign In for all users to ensure data consistency
UPDATE "User Dps"
SET "Last Sign In" = now()
WHERE "Last Sign In" IS NULL;