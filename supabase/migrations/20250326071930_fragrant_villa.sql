/*
  # Add leaderboard functions
  
  1. New Functions
    - get_top_collectors: Returns users with most coins
    - get_newest_users: Returns recently joined users
    
  2. Changes
    - Creates two new database functions for leaderboard data
*/

-- Function to get users with most coins
CREATE OR REPLACE FUNCTION get_top_collectors(limit_count integer DEFAULT 10)
RETURNS TABLE (
  username text,
  coin_count bigint,
  profile_image text,
  status text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ud."Username"::text,
    ud."Number Of Coins"::bigint,
    ud."piture link"::text,
    ud."Status"::text
  FROM "User Dps" ud
  WHERE ud."Number Of Coins" > 0
  ORDER BY ud."Number Of Coins" DESC
  LIMIT limit_count;
END;
$$;

-- Function to get newest users
CREATE OR REPLACE FUNCTION get_newest_users(limit_count integer DEFAULT 10)
RETURNS TABLE (
  username text,
  joined_date timestamptz,
  profile_image text,
  status text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ud."Username"::text,
    ud."Created At"::timestamptz,
    ud."piture link"::text,
    ud."Status"::text
  FROM "User Dps" ud
  ORDER BY ud."Created At" DESC
  LIMIT limit_count;
END;
$$;