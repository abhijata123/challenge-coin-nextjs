/*
  # Add admin functionality for posts
  
  1. Changes
    - Set new admin user
    - Add admin functions for post management
    
  2. Security
    - Maintain existing security model
*/

-- Set new admin user
UPDATE "User Dps"
SET is_admin = true
WHERE email = 'abhijatasen18+charlotte@gmail.com';

-- Update post policies to allow admin deletion
DROP POLICY IF EXISTS "Users can delete own posts" ON posts;
CREATE POLICY "Users can delete own posts"
ON posts
FOR DELETE
TO authenticated
USING (
  (auth.jwt() ->> 'email')::text = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM "User Dps"
    WHERE email = (auth.jwt() ->> 'email')::text
    AND is_admin = true
  )
);

-- Update comment policies to allow admin deletion
DROP POLICY IF EXISTS "Users can delete own comments" ON post_comments;
CREATE POLICY "Users can delete own comments"
ON post_comments
FOR DELETE
TO authenticated
USING (
  (auth.jwt() ->> 'email')::text = user_id
  OR
  EXISTS (
    SELECT 1 FROM "User Dps"
    WHERE email = (auth.jwt() ->> 'email')::text
    AND is_admin = true
  )
);