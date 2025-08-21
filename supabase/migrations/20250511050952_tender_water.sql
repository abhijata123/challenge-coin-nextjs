/*
  # Fix coin priority function
  
  1. Changes
    - Drop existing function first to avoid return type error
    - Create improved function to update coin priorities in batch
    - Add better error handling and increased timeout
    
  2. Security
    - Maintain existing security model with SECURITY DEFINER
*/

-- Drop the existing function first to avoid return type error
DROP FUNCTION IF EXISTS update_coin_priorities(jsonb[]);

-- Create function to update coin priorities in batch
CREATE OR REPLACE FUNCTION update_coin_priorities(
  p_coin_updates jsonb[]
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '60s'  -- Increase timeout to 60 seconds
AS $$
DECLARE
  v_coin jsonb;
  v_coin_id bigint;
  v_priority integer;
BEGIN
  -- Update each coin's priority
  FOREACH v_coin IN ARRAY p_coin_updates
  LOOP
    v_coin_id := (v_coin->>'id')::bigint;
    v_priority := (v_coin->>'Priority')::integer;
    
    UPDATE "Challenge Coin Table"
    SET "Priority" = v_priority
    WHERE id = v_coin_id;
  END LOOP;
  
  RETURN 'success';
EXCEPTION
  WHEN OTHERS THEN
    RETURN SQLERRM;
END;
$$;