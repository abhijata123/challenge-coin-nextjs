/*
  # Add function to get active users

  1. New Functions
    - `get_active_users`: Returns the most active users based on coin uploads
      - Returns username and count of coins uploaded
      - Orders by count descending
      - Limits to 10 users

  2. Security
    - Function is accessible to all users
*/

CREATE OR REPLACE FUNCTION get_active_users()
RETURNS TABLE (
  username text,
  count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    "Username"::text,
    COUNT(*)::bigint
  FROM "Challenge Coin Table"
  WHERE "Username" IS NOT NULL
  GROUP BY "Username"
  ORDER BY COUNT(*) DESC
  LIMIT 10;
END;
$$;