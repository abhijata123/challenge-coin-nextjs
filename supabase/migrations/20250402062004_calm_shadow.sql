/*
  # Add delete functionality to posts
  
  1. Changes
    - Add delete cascade to post relationships
    - Update policies to allow post deletion
    
  2. Security
    - Only post owners can delete their posts
    - Cascading delete for related records
*/

-- Update post_likes foreign key
ALTER TABLE post_likes
DROP CONSTRAINT IF EXISTS post_likes_post_id_fkey,
ADD CONSTRAINT post_likes_post_id_fkey 
  FOREIGN KEY (post_id) 
  REFERENCES posts(id) 
  ON DELETE CASCADE;

-- Update post_comments foreign key
ALTER TABLE post_comments
DROP CONSTRAINT IF EXISTS post_comments_post_id_fkey,
ADD CONSTRAINT post_comments_post_id_fkey 
  FOREIGN KEY (post_id) 
  REFERENCES posts(id) 
  ON DELETE CASCADE;

-- Ensure delete policy exists
DROP POLICY IF EXISTS "Users can delete own posts" ON posts;
CREATE POLICY "Users can delete own posts"
  ON posts
  FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'email')::text = user_id);