/*
  # Update welcome coin function with correct images
  
  1. Changes
    - Update create_welcome_coin function to use correct Braav coin images
    - Keep existing functionality intact
    
  2. Security
    - Maintain existing security model
*/

-- Update function to create welcome coin for new users
CREATE OR REPLACE FUNCTION create_welcome_coin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create welcome coin for the new user
  INSERT INTO "Challenge Coin Table" (
    "UserId",
    "Username",
    "Coin Name",
    "Coin Image",
    "BacksideUrl",
    "Date Issued",
    "Mode Of Acquiring",
    "Number Of Coins",
    "Notes",
    "Public Display",
    available_quantity
  )
  VALUES (
    NEW.email,
    NEW."Username",
    'Braav Welcome Coin',
    'https://imagedelivery.net/4_y5kVkw2ENjgzV454LjcQ/a4b54d61-a6cc-4a5a-89f3-563a85aa2900/public',
    'https://imagedelivery.net/4_y5kVkw2ENjgzV454LjcQ/99e9b80d-49c9-4e43-8c16-b9c67d1c5400/public',
    CURRENT_DATE,
    'gifted',
    1,
    'Welcome to Braav! This is your first challenge coin.',
    true,
    1
  );

  RETURN NEW;
END;
$$;

-- Recreate trigger for welcome coin
DROP TRIGGER IF EXISTS create_welcome_coin_trigger ON "User Dps";
CREATE TRIGGER create_welcome_coin_trigger
AFTER INSERT ON "User Dps"
FOR EACH ROW
EXECUTE FUNCTION create_welcome_coin();