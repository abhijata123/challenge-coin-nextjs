/*
  # Add admin role functionality

  1. Changes
    - Add is_admin column to User Dps table
    - Set initial admin user
    - Add functions for admin operations
    
  2. Security
    - Only admins can perform admin actions
*/

-- Add is_admin column to User Dps table
ALTER TABLE "User Dps"
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Set initial admin user
UPDATE "User Dps"
SET is_admin = true
WHERE email = 'anna+test@braav.co';

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_user_admin(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM "User Dps"
    WHERE email = user_email
    AND is_admin = true
  );
END;
$$;

-- Function for admin to delete coin
CREATE OR REPLACE FUNCTION admin_delete_coin(
  admin_email text,
  coin_id bigint
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT (SELECT is_user_admin(admin_email)) THEN
    RETURN 'Unauthorized';
  END IF;

  -- Delete the coin
  DELETE FROM "Challenge Coin Table"
  WHERE id = coin_id;

  RETURN 'success';
END;
$$;

-- Function for admin to ban user
CREATE OR REPLACE FUNCTION admin_ban_user(
  admin_email text,
  user_email text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT (SELECT is_user_admin(admin_email)) THEN
    RETURN 'Unauthorized';
  END IF;

  -- Cannot ban another admin
  IF (SELECT is_user_admin(user_email)) THEN
    RETURN 'Cannot ban admin user';
  END IF;

  -- Ban user by deleting their coins
  DELETE FROM "Challenge Coin Table"
  WHERE "UserId" = (
    SELECT id::text
    FROM "User Dps"
    WHERE email = user_email
  );

  RETURN 'success';
END;
$$;