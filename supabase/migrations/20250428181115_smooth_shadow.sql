/*
  # Add new admin user
  
  1. Changes
    - Set admin status for additional user
    - Keep existing admin users
    
  2. Security
    - No changes to security policies
*/

-- Add new admin user
UPDATE "User Dps"
SET is_admin = true
WHERE email = 'anna+new@braav.co';