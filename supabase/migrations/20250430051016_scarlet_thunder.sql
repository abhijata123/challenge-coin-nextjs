-- Update function to create welcome coin for new users with correct image URLs
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
    'https://credhwdecybwcrkmhtrn.supabase.co/storage/v1/object/public/Coin%20Images//2025-04-29T21-38-55-680Z-jp534ptzzb.png',
    'https://credhwdecybwcrkmhtrn.supabase.co/storage/v1/object/public/Coin%20Images//2025-04-29T21-38-58-298Z-0wsvvah9cuzg.png',
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