-- Add function for admins to set founding member status
CREATE OR REPLACE FUNCTION set_founding_member_status(
  admin_email text,
  target_email text,
  is_founding boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM "User Dps"
    WHERE email = admin_email
    AND is_admin = true
  ) THEN
    RETURN 'Unauthorized: Only admins can set founding member status';
  END IF;

  -- Update user's founding member status
  UPDATE "User Dps"
  SET is_founding_member = is_founding
  WHERE email = target_email;

  RETURN 'success';
END;
$$;