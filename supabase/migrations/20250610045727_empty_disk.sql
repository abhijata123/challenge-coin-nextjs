/*
  # Add pending coin transfers table with RLS policies
  
  1. New Tables
    - pending_coin_transfers: Store transfers for unregistered users
    
  2. Security
    - Enable RLS with proper policies
    - Allow senders to view and create their own transfers
    - Allow system to process transfers
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