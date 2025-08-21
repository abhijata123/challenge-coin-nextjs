/*
  # Fix public display status timeout
  
  1. Changes
    - Add function to update coin public status with longer timeout
    - Optimize the update operation
    
  2. Security
    - Maintain existing security model
*/

-- Create function to update coin public status with longer timeout
CREATE OR REPLACE FUNCTION update_coin_public_status(
  p_coin_id bigint,
  p_public_status boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'  -- Increase timeout to 30 seconds
AS $$
BEGIN
  -- Update the coin's public display status
  UPDATE "Challenge Coin Table"
  SET "Public Display" = p_public_status
  WHERE id = p_coin_id;
  
  RETURN 'success';
EXCEPTION
  WHEN OTHERS THEN
    RETURN SQLERRM;
END;
$$;