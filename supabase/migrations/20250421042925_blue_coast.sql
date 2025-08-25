-- Drop existing function
DROP FUNCTION IF EXISTS transfer_coins;

-- Simplified transfer_coins function with better receiver handling
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
  v_sender_username text;
  v_receiver_exists boolean;
BEGIN
  -- Basic input validation
  IF sender_email = receiver_email THEN
    RETURN 'Cannot send coins to yourself';
  END IF;

  -- Get sender details
  SELECT "Username" INTO v_sender_username 
  FROM "User Dps" 
  WHERE email = sender_email;

  IF v_sender_username IS NULL THEN
    RETURN 'Sender not found';
  END IF;

  -- Get coin details
  SELECT * INTO v_coin
  FROM "Challenge Coin Table"
  WHERE id = p_coin_id 
  AND "UserId" = sender_email
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'Coin not found';
  END IF;

  IF v_coin.available_quantity < p_quantity THEN
    RETURN 'Insufficient quantity';
  END IF;

  -- Check if receiver exists in auth.users
  SELECT EXISTS (
    SELECT 1 FROM "User Dps" WHERE email = receiver_email
  ) INTO v_receiver_exists;

  -- Update sender's coin quantity
  IF v_coin.available_quantity = p_quantity THEN
    DELETE FROM "Challenge Coin Table"
    WHERE id = p_coin_id;
  ELSE
    UPDATE "Challenge Coin Table"
    SET 
      available_quantity = available_quantity - p_quantity,
      "Number Of Coins" = "Number Of Coins" - p_quantity
    WHERE id = p_coin_id;
  END IF;

  -- Handle transfer based on receiver existence
  IF NOT v_receiver_exists THEN
    -- Store as pending transfer
    INSERT INTO pending_coin_transfers (
      sender_email,
      receiver_email,
      coin_id,
      coin_name,
      coin_image,
      backside_url,
      quantity,
      rarity_level
    ) VALUES (
      sender_email,
      receiver_email,
      p_coin_id,
      v_coin."Coin Name",
      v_coin."Coin Image",
      v_coin."BacksideUrl",
      p_quantity,
      v_coin."Rarity Level"
    );
  ELSE
    -- Get receiver's username
    DECLARE
      v_receiver_username text;
    BEGIN
      SELECT "Username" INTO v_receiver_username
      FROM "User Dps"
      WHERE email = receiver_email;

      -- Update or create receiver's coin
      IF EXISTS (
        SELECT 1 
        FROM "Challenge Coin Table"
        WHERE "UserId" = receiver_email
        AND "Coin Name" = v_coin."Coin Name"
      ) THEN
        -- Update existing coin
        UPDATE "Challenge Coin Table"
        SET 
          "Number Of Coins" = "Number Of Coins" + p_quantity,
          available_quantity = available_quantity + p_quantity
        WHERE "UserId" = receiver_email
        AND "Coin Name" = v_coin."Coin Name";
      ELSE
        -- Create new coin
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
          available_quantity,
          "Rarity Level"
        )
        VALUES (
          receiver_email,
          v_receiver_username,
          v_coin."Coin Name",
          v_coin."Coin Image",
          v_coin."BacksideUrl",
          CURRENT_DATE,
          'gifted',
          p_quantity,
          'Received from ' || v_sender_username,
          false,
          p_quantity,
          v_coin."Rarity Level"
        );
      END IF;
    END;
  END IF;

  -- Record the transfer
  INSERT INTO coin_transfers (
    sender_id,
    receiver_id,
    coin_id,
    quantity,
    status
  ) VALUES (
    sender_email,
    receiver_email,
    p_coin_id,
    p_quantity,
    'completed'
  );

  RETURN 'success';
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback will happen automatically
    RETURN SQLERRM;
END;
$$;