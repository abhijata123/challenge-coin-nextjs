/*
  # Improve notifications system
  
  1. Changes
    - Add last_read_at column to notifications
    - Add last_read_timestamp to User Dps
    - Add function to mark notifications as read
    
  2. Security
    - Maintain existing security model
*/

-- Add last_read_at column to notifications
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

-- Add last_read_timestamp to User Dps
ALTER TABLE "User Dps"
ADD COLUMN IF NOT EXISTS last_read_timestamp timestamptz;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_as_read(p_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_timestamp timestamptz;
BEGIN
  -- Get current timestamp
  v_timestamp := now();

  -- Update all unread notifications
  UPDATE notifications
  SET 
    read = true,
    last_read_at = v_timestamp
  WHERE user_id = p_user_id
  AND read = false;

  -- Update user's last read timestamp
  UPDATE "User Dps"
  SET last_read_timestamp = v_timestamp
  WHERE email = p_user_id;
END;
$$;