/*
  # Update posts table security policies
  
  1. Changes
    - Enable RLS on posts table
    - Add policies for authenticated users to:
      - View all posts
      - Create their own posts
      - Update their own posts
      - Delete their own posts
    
  2. Security
    - All users can view all posts
    - Users can only modify their own posts
*/

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Open policy for posts" ON posts;

-- Create new policies
CREATE POLICY "Users can view all posts"
  ON posts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create posts"
  ON posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);