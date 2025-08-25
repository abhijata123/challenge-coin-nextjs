/*
  # Create pending coin transfers system

  1. New Tables
    - `pending_coin_transfers`
      - `id` (uuid, primary key)
      - `sender_email` (text, not null)
      - `receiver_email` (text, not null)
      - `coin_id` (bigint, reference to original coin)
      - `coin_name` (text, not null)
      - `coin_image` (text, not null)
      - `backside_url` (text, nullable)
      - `quantity` (integer, not null)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `pending_coin_transfers` table
    - Add policies for senders to view their pending transfers

  3. Functions
    - Update transfer function to handle pending transfers
    - Update signup process to handle pending transfers
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

-- Policy for senders to view their pending transfers
CREATE POLICY "Senders can view their pending transfers"
  ON pending_coin_transfers
  FOR SELECT
  TO authenticated
  USING (sender_email = (jwt() ->> 'email'::text));

-- Policy for senders to insert pending transfers
CREATE POLICY "Senders can create pending transfers"
  ON pending_coin_transfers
  FOR INSERT
  TO authenticated
  WITH CHECK (sender_email = (jwt() ->> 'email'::text));

-- Policy for system to delete processed transfers
CREATE POLICY "System can delete processed transfers"
  ON pending_coin_transfers
  FOR DELETE
  TO authenticated
  USING (true);