-- Drop the existing function first to avoid return type error
DROP FUNCTION IF EXISTS update_coin_priorities(jsonb[]);

-- Create function to update coin priorities in batch with proper error handling
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
  v_updated_count integer := 0;
BEGIN
  -- Update each coin's priority
  FOREACH v_coin IN ARRAY p_coin_updates
  LOOP
    v_coin_id := (v_coin->>'id')::bigint;
    v_priority := (v_coin->>'Priority')::integer;
    
    -- Validate inputs
    IF v_coin_id IS NULL OR v_priority IS NULL THEN
      CONTINUE; -- Skip invalid entries
    END IF;
    
    -- Update the coin priority
    UPDATE "Challenge Coin Table"
    SET "Priority" = v_priority
    WHERE id = v_coin_id;
    
    v_updated_count := v_updated_count + 1;
  END LOOP;
  
  -- Log the number of updated coins
  RAISE NOTICE 'Updated % coins', v_updated_count;
  
  RETURN 'success';
EXCEPTION
  WHEN OTHERS THEN
    RETURN SQLERRM;
END;
$$;