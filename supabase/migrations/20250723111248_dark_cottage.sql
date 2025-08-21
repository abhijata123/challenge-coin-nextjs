/*
  # Admin Vetting System

  1. Security Functions
    - `is_vetting_admin()` - Check if current user is authorized vetting admin
    - `approve_vetting_request()` - Securely approve vetting requests
    - `get_pending_vetting_requests()` - Get pending requests for admins only

  2. Security
    - Only specific emails can approve vetting requests
    - Database-level security enforcement
    - RLS policies updated for maximum security
*/

-- Function to check if current user is a vetting admin
CREATE OR REPLACE FUNCTION is_vetting_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN auth.email() IN (
    'anna+test@braav.co',
    'abhijatasen18+charlotte@gmail.com', 
    'ashleyblewis@gmail.com'
  );
END;
$$;

-- Function to approve vetting requests (only for admins)
CREATE OR REPLACE FUNCTION approve_vetting_request(request_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_record RECORD;
BEGIN
  -- Check if user is authorized admin
  IF NOT is_vetting_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only vetting administrators can approve requests';
  END IF;
  
  -- Get the vetting request
  SELECT * INTO request_record 
  FROM "Vetting_Table" 
  WHERE id = request_id;
  
  -- Check if request exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vetting request not found';
  END IF;
  
  -- Check if already approved
  IF request_record.status = true THEN
    RAISE EXCEPTION 'Request already approved';
  END IF;
  
  -- Approve the request
  UPDATE "Vetting_Table"
  SET 
    status = true,
    approved_at = NOW()
  WHERE id = request_id;
  
  -- Log the approval (optional)
  INSERT INTO admin_actions (
    admin_email,
    action_type,
    target_id,
    details,
    created_at
  ) VALUES (
    auth.email(),
    'approve_vetting',
    request_id::text,
    jsonb_build_object(
      'user_email', request_record."userId",
      'approved_at', NOW()
    ),
    NOW()
  );
  
  RETURN 'success';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to approve vetting request: %', SQLERRM;
END;
$$;

-- Function to get pending vetting requests (only for admins)
CREATE OR REPLACE FUNCTION get_pending_vetting_requests()
RETURNS TABLE (
  id bigint,
  user_email text,
  submitted_at timestamp with time zone,
  user_details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is authorized admin
  IF NOT is_vetting_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only vetting administrators can view pending requests';
  END IF;
  
  RETURN QUERY
  SELECT 
    v.id,
    v."userId" as user_email,
    v.created_at as submitted_at,
    jsonb_build_object(
      'username', u."Username",
      'profile_image', u."piture link",
      'bio', u."Bio",
      'status', u."Status",
      'location', u."Location",
      'coin_count', u."Number Of Coins"
    ) as user_details
  FROM "Vetting_Table" v
  LEFT JOIN "User Dps" u ON u.email = v."userId"
  WHERE v.status = false
  ORDER BY v.created_at ASC;
END;
$$;

-- Create admin actions log table for audit trail
CREATE TABLE IF NOT EXISTS admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email text NOT NULL,
  action_type text NOT NULL,
  target_id text,
  details jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT NOW()
);

-- Enable RLS on admin_actions
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Only vetting admins can view admin actions
CREATE POLICY "Vetting admins can view admin actions"
  ON admin_actions
  FOR SELECT
  TO authenticated
  USING (is_vetting_admin());

-- Update Vetting_Table RLS policies for maximum security
DROP POLICY IF EXISTS "Users can view their own vetting status" ON "Vetting_Table";
DROP POLICY IF EXISTS "Users can insert their own vetting request" ON "Vetting_Table";
DROP POLICY IF EXISTS "No direct updates allowed" ON "Vetting_Table";

-- Users can only view their own vetting status
CREATE POLICY "Users can view their own vetting status"
  ON "Vetting_Table"
  FOR SELECT
  TO authenticated
  USING ("userId" = auth.email() OR is_vetting_admin());

-- Users can only insert their own vetting request
CREATE POLICY "Users can insert their own vetting request"
  ON "Vetting_Table"
  FOR INSERT
  TO authenticated
  WITH CHECK ("userId" = auth.email());

-- Prevent all direct updates - only RPC functions can update
CREATE POLICY "No direct updates allowed"
  ON "Vetting_Table"
  FOR UPDATE
  TO authenticated
  USING (false);

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION is_vetting_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION approve_vetting_request(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_vetting_requests() TO authenticated;