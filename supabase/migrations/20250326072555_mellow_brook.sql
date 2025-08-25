/*
  # Add safe leaderboard functions
  
  1. Changes
    - Add function to get top collectors based on existing data
    - Add function to get newest users based on auth.users
    - No modifications to existing tables or data
    - No triggers or constraints added
  
  2. Security
    - Functions are marked as SECURITY DEFINER
    - Only read operations, no data modifications
*/

-- Function to safely get users with most coins
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
    COUNT(cct.id)::bigint as coin_count,
    ud."piture link"::text,
    ud."Status"::text
  FROM "User Dps" ud
  LEFT JOIN "Challenge Coin Table" cct ON cct."UserId" = ud.id::text
  GROUP BY ud."Username", ud."piture link", ud."Status"
  HAVING COUNT(cct.id) > 0
  ORDER BY COUNT(cct.id) DESC
  LIMIT limit_count;
END;
$$;

-- Function to safely get newest users
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
    au.created_at::timestamptz,
    ud."piture link"::text,
    ud."Status"::text
  FROM auth.users au
  JOIN "User Dps" ud ON ud.email = au.email
  ORDER BY au.created_at DESC
  LIMIT limit_count;
END;
$$;