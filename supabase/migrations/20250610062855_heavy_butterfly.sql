/*
  # Create pending coin transfers table

  1. New Tables
    - `pending_coin_transfers`
      - `id` (uuid, primary key)
      - `sender_email` (text, not null)
      - `receiver_email` (text, not null)
      - `coin_id` (bigint, not null)
      - `coin_name` (text, not null)
      - `coin_image` (text, not null)
      - `backside_url` (text, nullable)
      - `quantity` (integer, not null, > 0)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `pending_coin_transfers` table
    - Add policies for senders to view and create their pending transfers
    - Add policy for system to delete processed transfers
*/

CREATE TABLE IF NOT EXISTS pending_coin_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_email text NOT NULL,
  receiver_email text NOT NULL,
  coin_id bigint NOT NULL,
  coin_name text NOT NULL,
  coin_image text NOT NULL,
  backside_url text,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pending_coin_transfers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Senders can view their pending transfers" ON pending_coin_transfers;
DROP POLICY IF EXISTS "Senders can create pending transfers" ON pending_coin_transfers;
DROP POLICY IF EXISTS "System can delete processed transfers" ON pending_coin_transfers;

-- Policy for senders to view their pending transfers
CREATE POLICY "Senders can view their pending transfers"
  ON pending_coin_transfers
  FOR SELECT
  TO authenticated
  USING (sender_email = (auth.jwt() ->> 'email'::text));

-- Policy for senders to insert pending transfers
CREATE POLICY "Senders can create pending transfers"
  ON pending_coin_transfers
  FOR INSERT
  TO authenticated
  WITH CHECK (sender_email = (auth.jwt() ->> 'email'::text));

-- Policy for system to delete processed transfers
CREATE POLICY "System can delete processed transfers"
  ON pending_coin_transfers
  FOR DELETE
  TO authenticated
  USING (true);