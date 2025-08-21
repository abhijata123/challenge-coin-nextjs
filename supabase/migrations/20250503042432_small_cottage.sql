/*
  # Fix coin quantity discrepancy
  
  1. Changes
    - Synchronize "Number Of Coins" and "available_quantity" fields
    - Update transfer_coins function to maintain consistency
    - Add trigger to ensure fields stay in sync
    
  2. Security
    - Maintain existing security model
*/

-- First, update all existing records to ensure consistency
UPDATE "Challenge Coin Table"
SET available_quantity = "Number Of Coins"
WHERE available_quantity != "Number Of Coins";

-- Create function to ensure fields stay in sync
CREATE OR REPLACE FUNCTION sync_coin_quantities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- For new records, ensure available_quantity matches Number Of Coins
    NEW.available_quantity := NEW."Number Of Coins";
  ELSIF TG_OP = 'UPDATE' THEN
    -- For updates, sync the fields if one changes
    IF NEW."Number Of Coins" != OLD."Number Of Coins" AND NEW.available_quantity = OLD.available_quantity THEN
      NEW.available_quantity := NEW."Number Of Coins";
    ELSIF NEW.available_quantity != OLD.available_quantity AND NEW."Number Of Coins" = OLD."Number Of Coins" THEN
      NEW."Number Of Coins" := NEW.available_quantity;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to maintain consistency
DROP TRIGGER IF EXISTS sync_coin_quantities_trigger ON "Challenge Coin Table";
CREATE TRIGGER sync_coin_quantities_trigger
BEFORE INSERT OR UPDATE ON "Challenge Coin Table"
FOR EACH ROW
EXECUTE FUNCTION sync_coin_quantities();

-- Update transfer_coins function to maintain consistency
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

  -- Get coin details - check both UserId and Username to handle all cases
  SELECT * INTO v_coin
  FROM "Challenge Coin Table"
  WHERE id = p_coin_id 
  AND ("UserId" = sender_email OR "Username" = v_sender_username)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'Coin not found';
  END IF;

  -- Check both fields to ensure we have enough coins
  IF v_coin.available_quantity < p_quantity OR v_coin."Number Of Coins" < p_quantity THEN
    RETURN 'Insufficient quantity';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM "User Dps" WHERE email = receiver_email
  ) INTO v_receiver_exists;

  -- Update or delete sender's coin
  IF v_coin."Number Of Coins" = p_quantity THEN
    DELETE FROM "Challenge Coin Table"
    WHERE id = p_coin_id;
  ELSE
    UPDATE "Challenge Coin Table"
    SET 
      "Number Of Coins" = "Number Of Coins" - p_quantity,
      available_quantity = "Number Of Coins" - p_quantity
    WHERE id = p_coin_id;
  END IF;

  -- Send data to webhook with fixed coin image URL
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
        'coinImage', 'https://credhwdecybwcrkmhtrn.supabase.co/storage/v1/object/public/Coin%20Images//hintcoin.png',
        'quantity', p_quantity
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
          available_quantity = "Number Of Coins" + p_quantity
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