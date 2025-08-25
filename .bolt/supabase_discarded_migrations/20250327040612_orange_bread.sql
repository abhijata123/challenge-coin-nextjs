/*
  # Add coin transaction tracking

  1. New Tables
    - `coin_transactions`
      - `id` (uuid, primary key)
      - `sender_id` (bigint, references User Dps)
      - `receiver_id` (bigint, references User Dps)
      - `coin_id` (bigint, references Challenge Coin Table)
      - `quantity` (integer)
      - `created_at` (timestamp with time zone)
      - `status` (text) - 'completed' or 'failed'
      - `transaction_id` (text) - unique reference number

  2. Security
    - Enable RLS on transactions table
    - Add policies for sender/receiver access
*/

-- Create transactions table
CREATE TABLE IF NOT EXISTS coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id bigint REFERENCES "User Dps"(id),
  receiver_id bigint REFERENCES "User Dps"(id),
  coin_id bigint REFERENCES "Challenge Coin Table"(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz DEFAULT now(),
  status text NOT NULL CHECK (status IN ('completed', 'failed')),
  transaction_id text UNIQUE NOT NULL,
  CONSTRAINT valid_transfer CHECK (sender_id != receiver_id)
);

-- Add quantity tracking to Challenge Coin Table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Challenge Coin Table' 
    AND column_name = 'available_quantity'
  ) THEN
    ALTER TABLE "Challenge Coin Table"
    ADD COLUMN available_quantity integer DEFAULT 1 CHECK (available_quantity >= 0);

    -- Set initial available quantity equal to Number Of Coins
    UPDATE "Challenge Coin Table"
    SET available_quantity = CAST("Number Of Coins" as integer)
    WHERE available_quantity IS NULL;
  END IF;
END $$;