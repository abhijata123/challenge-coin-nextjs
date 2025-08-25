/*
  # Fix transfer function overloading issue

  1. Drop existing transfer functions to resolve overloading conflict
  2. Create a single, properly defined transfer_coins_with_note function
  3. Ensure all parameters are handled correctly
*/

-- Drop all existing versions of the transfer function
DROP FUNCTION IF EXISTS transfer_coins_with_note(TEXT, TEXT, BIGINT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS transfer_coins_with_note(TEXT, TEXT, BIGINT, INTEGER, TEXT, TEXT);

-- Create the definitive transfer function
CREATE OR REPLACE FUNCTION transfer_coins_with_note(
  sender_email TEXT,
  receiver_email TEXT,
  p_coin_id BIGINT,
  p_quantity INTEGER,
  p_note TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sender_coin RECORD;
  receiver_user RECORD;
  sender_user RECORD;
  new_coin_id BIGINT;
  awarded_by_name TEXT;
BEGIN
  -- Validate inputs
  IF sender_email IS NULL OR receiver_email IS NULL OR p_coin_id IS NULL OR p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN 'Invalid input parameters';
  END IF;

  IF sender_email = receiver_email THEN
    RETURN 'Cannot send coins to yourself';
  END IF;

  -- Get sender user info
  SELECT * INTO sender_user FROM "User Dps" WHERE email = sender_email;
  IF NOT FOUND THEN
    RETURN 'Sender not found';
  END IF;

  -- Set awarded by name to sender's username
  awarded_by_name := sender_user."Username";

  -- Get the coin to transfer
  SELECT * INTO sender_coin FROM "Challenge Coin Table" 
  WHERE id = p_coin_id AND "UserId" = sender_email;
  
  IF NOT FOUND THEN
    RETURN 'Coin not found or you do not own this coin';
  END IF;

  -- Check if sender has enough coins
  IF sender_coin.available_quantity < p_quantity THEN
    RETURN 'Insufficient coins available';
  END IF;

  -- Check if receiver exists
  SELECT * INTO receiver_user FROM "User Dps" WHERE email = receiver_email;
  
  IF NOT FOUND THEN
    -- Receiver doesn't exist, create pending transfer
    INSERT INTO pending_coin_transfers (
      sender_email,
      receiver_email,
      coin_id,
      coin_name,
      coin_image,
      backside_url,
      quantity,
      notes
    ) VALUES (
      sender_email,
      receiver_email,
      sender_coin.id,
      sender_coin."Coin Name",
      sender_coin."Coin Image",
      sender_coin."BacksideUrl",
      p_quantity,
      p_note
    );

    -- Update sender's available quantity
    UPDATE "Challenge Coin Table"
    SET available_quantity = available_quantity - p_quantity
    WHERE id = p_coin_id AND "UserId" = sender_email;

    RETURN 'pending';
  END IF;

  -- Receiver exists, proceed with immediate transfer
  -- Check if receiver already has this coin
  SELECT id INTO new_coin_id FROM "Challenge Coin Table"
  WHERE "UserId" = receiver_email 
    AND "Coin Name" = sender_coin."Coin Name"
    AND "Coin Image" = sender_coin."Coin Image";

  IF FOUND THEN
    -- Update existing coin quantity and notes
    UPDATE "Challenge Coin Table"
    SET 
      "Number Of Coins" = "Number Of Coins" + p_quantity,
      available_quantity = available_quantity + p_quantity,
      "Notes" = COALESCE(p_note, "Notes"),
      "Awarded By" = awarded_by_name
    WHERE id = new_coin_id;
  ELSE
    -- Create new coin entry for receiver
    INSERT INTO "Challenge Coin Table" (
      "Coin Name",
      "Date Issued",
      "Coin Image",
      "BacksideUrl",
      "Mode Of Acquiring",
      "Number Of Coins",
      available_quantity,
      "UserId",
      "Username",
      "Notes",
      "Awarded By",
      "Issuer Name",
      "Featured",
      "Public Display",
      "Priority",
      "Has Copyright"
    ) VALUES (
      sender_coin."Coin Name",
      sender_coin."Date Issued",
      sender_coin."Coin Image",
      sender_coin."BacksideUrl",
      'received',
      p_quantity,
      p_quantity,
      receiver_email,
      receiver_user."Username",
      COALESCE(p_note, sender_coin."Notes"),
      awarded_by_name,
      sender_coin."Issuer Name",
      false,
      false,
      0,
      sender_coin."Has Copyright"
    );
  END IF;

  -- Update sender's available quantity
  UPDATE "Challenge Coin Table"
  SET available_quantity = available_quantity - p_quantity
  WHERE id = p_coin_id AND "UserId" = sender_email;

  -- Update sender's total if no coins left
  IF sender_coin.available_quantity - p_quantity = 0 THEN
    UPDATE "Challenge Coin Table"
    SET "Number Of Coins" = "Number Of Coins" - p_quantity
    WHERE id = p_coin_id AND "UserId" = sender_email;
  END IF;

  RETURN 'success';
END;
$$;