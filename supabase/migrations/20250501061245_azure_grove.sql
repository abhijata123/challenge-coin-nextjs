/*
  # Add founding member functionality
  
  1. Changes
    - Add function for admins to set founding member status
    - Update existing admin functions
    
  2. Security
    - Only admins can set founding member status
    - Function runs with security definer
*/

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
BEGIN
  -- Check if user is admin
  SELECT is_admin INTO v_is_admin
  FROM "User Dps"
  WHERE email = admin_email;

  IF NOT v_is_admin THEN
    RETURN 'Unauthorized: Only admins can set founding member status';
  END IF;

  -- Update founding member status
  UPDATE "User Dps"
  SET is_founding_member = is_founding
  WHERE email = target_email;

  RETURN 'success';
EXCEPTION
  WHEN OTHERS THEN
    RETURN SQLERRM;
END;
$$;