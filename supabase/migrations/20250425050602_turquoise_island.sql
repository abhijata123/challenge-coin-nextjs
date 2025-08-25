/*
  # Add function to update coin priorities in batch
  
  1. Changes
    - Add function to update multiple coin priorities at once
    - Ensure atomic updates
    - Maintain data consistency
*/

-- Create function to update coin priorities in batch
CREATE OR REPLACE FUNCTION update_coin_priorities(coin_updates jsonb[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update each coin's priority
  FOR i IN 1..array_length(coin_updates, 1) LOOP
    UPDATE "Challenge Coin Table"
    SET "Priority" = (coin_updates[i]->>'Priority')::integer
    WHERE id = (coin_updates[i]->>'id')::bigint;
  END LOOP;
END;
$$;