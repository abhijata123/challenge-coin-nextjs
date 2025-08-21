/*
  # Update transfer coins webhook URL
  
  1. Changes
    - Update webhook URL in transfer_coins function
    - Keep all other functionality intact
    
  2. Security
    - Maintain existing security model
*/

-- Update transfer_coins function with new webhook URL
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
  IF sender_email = receiver_email THEN
    RETURN 'Cannot send coins to yourself';
  END IF;

  SELECT "Username" INTO v_sender_username 
  FROM "User Dps" 
  WHERE email = sender_email;

  IF v_sender_username IS NULL THEN
    RETURN 'Sender not found';
  END IF;

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

  SELECT EXISTS (
    SELECT 1 FROM "User Dps" WHERE email = receiver_email
  ) INTO v_receiver_exists;

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

  -- Send data to webhook with public URL
  PERFORM net.http_post(
    url := 'https://hook.us2.make.com/d58fj9taqiti7anxodqyd90qomt19rxn',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'userName', v_sender_username,
      'userEmail', sender_email,
      'receiverEmail', receiver_email,
      'coinDetails', jsonb_build_object(
        'coinName', v_coin."Coin Name",
        'coinImage', v_coin."Coin Image",
        'quantity', p_quantity,
        'publicUrl', format('https://coin.braav.co/collection/%s/coin/%s', v_sender_username, v_coin.id)
      )
    )
  );

  IF NOT v_receiver_exists THEN
    INSERT INTO pending_coin_transfers (
      sender_email,
      receiver_email,
      coin_id,
      coin_name,
      coin_image,
      backside_url,
      quantity
    ) VALUES (
      sender_email,
      receiver_email,
      p_coin_id,
      v_coin."Coin Name",
      v_coin."Coin Image",
      v_coin."BacksideUrl",
      p_quantity
    );
  ELSE
    DECLARE
      v_receiver_username text;
    BEGIN
      SELECT "Username" INTO v_receiver_username
      FROM "User Dps"
      WHERE email = receiver_email;

      IF EXISTS (
        SELECT 1 
        FROM "Challenge Coin Table"
        WHERE "UserId" = receiver_email
        AND "Coin Name" = v_coin."Coin Name"
      ) THEN
        UPDATE "Challenge Coin Table"
        SET 
          "Number Of Coins" = "Number Of Coins" + p_quantity,
          available_quantity = available_quantity + p_quantity
        WHERE "UserId" = receiver_email
        AND "Coin Name" = v_coin."Coin Name";
      ELSE
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
          'gifted',
          p_quantity,
          'Received from ' || v_sender_username,
          false,
          p_quantity
        );
      END IF;
    END;
  END IF;

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
    RETURN SQLERRM;
END;
$$;