/*
  # Add coin transfer functionality

  1. New Tables
    - `coin_transfers`
      - `id` (uuid, primary key)
      - `sender_id` (text, references User Dps)
      - `receiver_id` (text, references User Dps)
      - `coin_id` (bigint, references Challenge Coin Table)
      - `quantity` (integer)
      - `created_at` (timestamp with time zone)
      - `status` (text)

  2. Changes
    - Add available_quantity to Challenge Coin Table
    - Add transfer_coins function
    - Add trigger to update coin counts
*/

-- Add available_quantity to Challenge Coin Table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Challenge Coin Table' 
    AND column_name = 'available_quantity'
  ) THEN
    ALTER TABLE "Challenge Coin Table"
    ADD COLUMN available_quantity integer DEFAULT 1;

    -- Set initial available quantity
    UPDATE "Challenge Coin Table"
    SET available_quantity = CAST("Number Of Coins" as integer)
    WHERE available_quantity IS NULL;
  END IF;
END $$;

-- Create transfers table
CREATE TABLE IF NOT EXISTS coin_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id text NOT NULL,
  receiver_id text NOT NULL,
  coin_id bigint REFERENCES "Challenge Coin Table"(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz DEFAULT now(),
  status text NOT NULL CHECK (status IN ('completed', 'pending', 'failed'))
);

-- Function to transfer coins
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
  v_sender_id text;
  v_receiver_id text;
  v_coin record;
  v_transfer_id uuid;
BEGIN
  -- Get sender and receiver IDs
  SELECT id::text INTO v_sender_id FROM "User Dps" WHERE email = sender_email;
  SELECT id::text INTO v_receiver_id FROM "User Dps" WHERE email = receiver_email;

  IF v_sender_id IS NULL THEN
    RETURN 'Sender not found';
  END IF;

  IF v_receiver_id IS NULL THEN
    RETURN 'Receiver not found';
  END IF;

  -- Get coin details
  SELECT * INTO v_coin
  FROM "Challenge Coin Table"
  WHERE id = p_coin_id AND "UserId" = v_sender_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'Coin not found';
  END IF;

  IF v_coin.available_quantity < p_quantity THEN
    RETURN 'Insufficient quantity';
  END IF;

  -- Create transfer record
  INSERT INTO coin_transfers (sender_id, receiver_id, coin_id, quantity, status)
  VALUES (v_sender_id, v_receiver_id, p_coin_id, p_quantity, 'pending')
  RETURNING id INTO v_transfer_id;

  -- Update sender's coin quantity
  UPDATE "Challenge Coin Table"
  SET 
    available_quantity = available_quantity - p_quantity,
    "Number Of Coins" = available_quantity - p_quantity
  WHERE id = p_coin_id;

  -- Create or update receiver's coin record
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
    v_receiver_id,
    (SELECT "Username" FROM "User Dps" WHERE id::text = v_receiver_id),
    v_coin."Coin Name",
    v_coin."Coin Image",
    v_coin."BacksideUrl",
    CURRENT_DATE,
    'Received',
    p_quantity,
    'Received from ' || (SELECT "Username" FROM "User Dps" WHERE id::text = v_sender_id),
    false,
    p_quantity
  )
  ON CONFLICT ("id") DO UPDATE
  SET 
    "Number Of Coins" = "Challenge Coin Table"."Number Of Coins" + p_quantity,
    available_quantity = "Challenge Coin Table".available_quantity + p_quantity;

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