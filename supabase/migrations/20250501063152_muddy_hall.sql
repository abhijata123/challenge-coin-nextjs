-- Function for admins to set founding member status
CREATE OR REPLACE FUNCTION set_founding_member_status(
  admin_email text,
  target_email text,
  is_founding boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
  v_target_username text;
BEGIN
  -- Check if user is admin
  SELECT is_admin INTO v_is_admin
  FROM "User Dps"
  WHERE email = admin_email;

  IF NOT v_is_admin THEN
    RETURN 'Unauthorized: Only admins can set founding member status';
  END IF;

  -- Get target username for logging
  SELECT "Username" INTO v_target_username
  FROM "User Dps"
  WHERE email = target_email;

  IF v_target_username IS NULL THEN
    RETURN 'Target user not found';
  END IF;

  -- Update founding member status
  UPDATE "User Dps"
  SET is_founding_member = is_founding
  WHERE email = target_email;

  -- Log the action
  RAISE NOTICE 'Admin % set founding member status to % for user % (%)', 
    admin_email, 
    is_founding, 
    v_target_username,
    target_email;

  RETURN 'success';
EXCEPTION
  WHEN OTHERS THEN
    RETURN SQLERRM;
END;
$$;