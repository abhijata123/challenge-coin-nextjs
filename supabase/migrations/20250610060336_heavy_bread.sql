/*
  # Add pending coin transfers table with RLS policies
  
  1. Changes
    - Create pending_coin_transfers table if it doesn't exist
    - Enable RLS with proper policies
    - Drop existing policies first to avoid conflicts
    
  2. Security
    - Allow senders to view and create their own transfers
    - Allow system to process transfers
*/

-- Create table if it doesn't exist
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

-- Enable RLS
ALTER TABLE pending_coin_transfers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Senders can view their pending transfers" ON pending_coin_transfers;
DROP POLICY IF EXISTS "Senders can create pending transfers" ON pending_coin_transfers;
DROP POLICY IF EXISTS "System can delete processed transfers" ON pending_coin_transfers;

-- Create policies
CREATE POLICY "Senders can view their pending transfers"
  ON pending_coin_transfers
  FOR SELECT
  TO authenticated
  USING (sender_email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Senders can create pending transfers"
  ON pending_coin_transfers
  FOR INSERT
  TO authenticated
  WITH CHECK (sender_email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "System can delete processed transfers"
  ON pending_coin_transfers
  FOR DELETE
  TO authenticated
  USING (true);