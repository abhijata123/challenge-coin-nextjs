-- Function to transfer coins with cleanup
CREATE OR REPLACE FUNCTION transfer_coins(
  sender_email text,
  receiver_email text,
  p_coin_id bigint,
  p_quantity integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coin record;
  v_transfer_id uuid;
  v_sender_username text;
  v_receiver_username text;
BEGIN
  -- Get usernames
  SELECT "Username" INTO v_sender_username 
  FROM "User Dps" 
  WHERE email = sender_email;

  SELECT "Username" INTO v_receiver_username 
  FROM "User Dps" 
  WHERE email = receiver_email;

  IF v_sender_username IS NULL THEN
    RETURN 'Sender not found';
  END IF;

  IF v_receiver_username IS NULL THEN
    RETURN 'Receiver not found';
  END IF;

  -- Get coin details
  SELECT * INTO v_coin
  FROM "Challenge Coin Table"
  WHERE id = p_coin_id AND "Username" = v_sender_username
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'Coin not found';
  END IF;

  IF v_coin.available_quantity < p_quantity THEN
    RETURN 'Insufficient quantity';
  END IF;

  -- Create transfer record
  INSERT INTO coin_transfers (
    sender_id, 
    receiver_id, 
    coin_id, 
    quantity, 
    status
  )
  VALUES (
    sender_email,
    receiver_email,
    p_coin_id,
    p_quantity,
    'pending'
  )
  RETURNING id INTO v_transfer_id;

  -- Update or delete sender's coin based on remaining quantity
  IF v_coin.available_quantity = p_quantity THEN
    -- Delete the coin if transferring all available quantity
    DELETE FROM "Challenge Coin Table"
    WHERE id = p_coin_id;
  ELSE
    -- Update quantity if keeping some coins
    UPDATE "Challenge Coin Table"
    SET 
      available_quantity = available_quantity - p_quantity,
      "Number Of Coins" = "Number Of Coins" - p_quantity
    WHERE id = p_coin_id;
  END IF;

  -- Check if receiver already has this coin
  IF EXISTS (
    SELECT 1 
    FROM "Challenge Coin Table"
    WHERE "Username" = v_receiver_username
    AND "Coin Name" = v_coin."Coin Name"
  ) THEN
    -- Update existing coin record
    UPDATE "Challenge Coin Table"
    SET 
      "Number Of Coins" = "Number Of Coins" + p_quantity,
      available_quantity = available_quantity + p_quantity
    WHERE "Username" = v_receiver_username
    AND "Coin Name" = v_coin."Coin Name";
  ELSE
    -- Create new coin record for receiver
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
      receiver_email,
      v_receiver_username,
      v_coin."Coin Name",
      v_coin."Coin Image",
      v_coin."BacksideUrl",
      CURRENT_DATE,
      'Received',
      p_quantity,
      'Received from ' || v_sender_username,
      false,
      p_quantity
    );
  END IF;

  -- Update transfer status
  UPDATE coin_transfers
  SET status = 'completed'
  WHERE id = v_transfer_id;

  RETURN 'success';
EXCEPTION
  WHEN OTHERS THEN
    -- Update transfer status to failed if exists
    IF v_transfer_id IS NOT NULL THEN
      UPDATE coin_transfers
      SET status = 'failed'
      WHERE id = v_transfer_id;
    END IF;
    RETURN SQLERRM;
END;
$$;