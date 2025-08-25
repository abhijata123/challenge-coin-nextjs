/*
  # Update leaderboard functions

  1. Changes
    - Modify get_top_collectors to include users with 0 coins
    - Keep existing functionality for get_newest_users
    - Ensure proper ordering with users having 0 coins

  2. Security
    - Maintain SECURITY DEFINER setting
    - Keep existing access controls
*/

-- Function to get all users ordered by coin count
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
    COALESCE(COUNT(cct.id), 0)::bigint as coin_count,
    ud."piture link"::text,
    ud."Status"::text
  FROM "User Dps" ud
  LEFT JOIN "Challenge Coin Table" cct ON cct."UserId" = ud.id::text
  GROUP BY ud."Username", ud."piture link", ud."Status"
  ORDER BY COUNT(cct.id) DESC, ud."Username" ASC
  LIMIT limit_count;
END;
$$;

-- Function to get newest users (unchanged, included for completeness)
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