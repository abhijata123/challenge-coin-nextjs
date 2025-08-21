/*
  # Fix statement timeout in update_coin_public_status function
  
  1. Changes
    - Increase statement timeout to 60 seconds
    - Add better error handling
    - Optimize the update operation
    
  2. Security
    - Maintain existing security model
*/

-- Create improved function to update coin public status with longer timeout
CREATE OR REPLACE FUNCTION update_coin_public_status(
  p_coin_id bigint,
  p_public_status boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '60s'  -- Increase timeout to 60 seconds
AS $$
DECLARE
  v_affected_rows integer;
BEGIN
  -- Update the coin's public display status with optimized query
  UPDATE "Challenge Coin Table"
  SET "Public Display" = p_public_status
  WHERE id = p_coin_id
  RETURNING 1 INTO v_affected_rows;
  
  -- Check if the update was successful
  IF v_affected_rows IS NULL OR v_affected_rows = 0 THEN
    RETURN 'Coin not found';
  END IF;
  
  RETURN 'success';
EXCEPTION
  WHEN OTHERS THEN
    RETURN SQLERRM;
END;
$$;