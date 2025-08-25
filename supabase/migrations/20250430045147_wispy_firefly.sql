/*
  # Add welcome coin functionality
  
  1. Changes
    - Add function to create welcome coin for new users
    - Create trigger to automatically add welcome coin
    
  2. Security
    - Maintain existing security model
*/

-- Function to create welcome coin for new users
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
    'https://images.unsplash.com/photo-1589656966895-2f33e7653819?w=800&q=80',
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

-- Create trigger for welcome coin
DROP TRIGGER IF EXISTS create_welcome_coin_trigger ON "User Dps";
CREATE TRIGGER create_welcome_coin_trigger
AFTER INSERT ON "User Dps"
FOR EACH ROW
EXECUTE FUNCTION create_welcome_coin();