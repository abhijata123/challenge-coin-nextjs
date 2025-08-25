/*
  # Add RLS policy for coin_wallets table

  1. Security
    - Add policy for users to read their own wallet data
    - Users can only access wallet records where user_id matches their email
    - Ensures wallet addresses are only visible to the wallet owner

  2. Changes
    - Create SELECT policy on coin_wallets table
    - Policy checks that user_id equals the authenticated user's email
*/

-- Create policy to allow users to read their own wallet data
CREATE POLICY "Users can view their own wallet data"
  ON coin_wallets
  FOR SELECT
  TO authenticated
  USING (user_id = (jwt() ->> 'email'::text));