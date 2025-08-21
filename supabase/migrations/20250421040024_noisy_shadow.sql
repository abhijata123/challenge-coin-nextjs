/*
  # Add pending transfers functionality
  
  1. New Tables
    - pending_coin_transfers: Store transfers for unregistered users
    
  2. Changes
    - Update transfer_coins function to handle pending transfers
    - Add function to process pending transfers on signup
    
  3. Security
    - Maintain existing security model
*/

-- Create pending_coin_transfers table
CREATE TABLE IF NOT EXISTS pending_coin_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_email text NOT NULL,
  receiver_email text NOT NULL,
  coin_id bigint NOT NULL,
  coin_name text NOT NULL,
  coin_image text NOT NULL,
  backside_url text,
  quantity integer NOT NULL CHECK (quantity > 0),
  rarity_level text,
  created_at timestamptz DEFAULT now()
);

-- Function to handle new user registration and process pending transfers
CREATE OR REPLACE FUNCTION process_pending_transfers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transfer record;
  v_username text;
BEGIN
  -- Get the new user's username
  SELECT "Username" INTO v_username
  FROM "User Dps"
  WHERE email = NEW.email;

  -- Process each pending transfer
  FOR v_transfer IN
    SELECT * FROM pending_coin_transfers
    WHERE receiver_email = NEW.email
  LOOP
    -- Create new coin record for the user
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
    ) VALUES (
      NEW.email,
      v_username,
      v_transfer.coin_name,
      v_transfer.coin_image,
      v_transfer.backside_url,
      CURRENT_DATE,
      'gifted',
      v_transfer.quantity,
      format('Received from %s while offline', (
        SELECT "Username" FROM "User Dps" WHERE email = v_transfer.sender_email
      )),
      false,
      v_transfer.quantity,
      v_transfer.rarity_level
    );

    -- Delete the processed transfer
    DELETE FROM pending_coin_transfers
    WHERE id = v_transfer.id;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS process_pending_transfers_trigger ON "User Dps";
CREATE TRIGGER process_pending_transfers_trigger
AFTER INSERT ON "User Dps"
FOR EACH ROW
EXECUTE FUNCTION process_pending_transfers();

-- Update transfer_coins function to handle unregistered users
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
  v_new_coin_id bigint;
BEGIN
  -- Get sender username
  SELECT "Username" INTO v_sender_username 
  FROM "User Dps" 
  WHERE email = sender_email;

  IF v_sender_username IS NULL THEN
    RETURN 'Sender not found';
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

  -- Check if receiver exists
  SELECT "Username" INTO v_receiver_username 
  FROM "User Dps" 
  WHERE email = receiver_email;

  -- Update sender's coin quantity
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

  -- Handle transfer based on receiver existence
  IF v_receiver_username IS NULL THEN
    -- Store as pending transfer for unregistered user
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
    -- Handle transfer for registered user (existing logic)
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
      AND "Coin Name" = v_coin."Coin Name"
      RETURNING id INTO v_new_coin_id;
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
      )
      RETURNING id INTO v_new_coin_id;
    END IF;
  END IF;

  RETURN 'success';
EXCEPTION
  WHEN OTHERS THEN
    RETURN SQLERRM;
END;
$$;