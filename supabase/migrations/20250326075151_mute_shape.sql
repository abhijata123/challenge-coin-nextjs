-- Function to get top collectors based on public coins
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
  LEFT JOIN "Challenge Coin Table" cct 
    ON cct."Username" = ud."Username" 
    AND cct."Public Display" = true
  GROUP BY ud."Username", ud."piture link", ud."Status"
  ORDER BY COUNT(cct.id) DESC, ud."Username" ASC
  LIMIT limit_count;
END;
$$;

-- Update User Dps table to track public coin count
ALTER TABLE "User Dps" 
ADD COLUMN IF NOT EXISTS "Public Coin Count" bigint DEFAULT 0;

-- Update existing public coin counts
UPDATE "User Dps" ud
SET "Public Coin Count" = (
  SELECT COUNT(*)
  FROM "Challenge Coin Table" cct
  WHERE cct."Username" = ud."Username"
  AND cct."Public Display" = true
);

-- Create function to maintain public coin count
CREATE OR REPLACE FUNCTION update_public_coin_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Update count for the affected user
    UPDATE "User Dps"
    SET "Public Coin Count" = (
      SELECT COUNT(*)
      FROM "Challenge Coin Table"
      WHERE "Username" = NEW."Username"
      AND "Public Display" = true
    )
    WHERE "Username" = NEW."Username";
  ELSIF TG_OP = 'DELETE' THEN
    -- Update count for the user whose coin was deleted
    UPDATE "User Dps"
    SET "Public Coin Count" = (
      SELECT COUNT(*)
      FROM "Challenge Coin Table"
      WHERE "Username" = OLD."Username"
      AND "Public Display" = true
    )
    WHERE "Username" = OLD."Username";
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger for maintaining public coin count
DROP TRIGGER IF EXISTS update_public_coin_count_trigger ON "Challenge Coin Table";
CREATE TRIGGER update_public_coin_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON "Challenge Coin Table"
FOR EACH ROW
EXECUTE FUNCTION update_public_coin_count();