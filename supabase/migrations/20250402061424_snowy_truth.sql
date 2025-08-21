/*
  # Add likes and comments functionality
  
  1. New Tables
    - post_likes: Track user likes on posts
    - post_comments: Store post comments
    
  2. Security
    - Enable RLS for both tables
    - Add appropriate policies
*/

-- Create post_likes table
CREATE TABLE post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  user_id text REFERENCES "User Dps"(email) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Create post_comments table
CREATE TABLE post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  user_id text REFERENCES "User Dps"(email) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Policies for post_likes
CREATE POLICY "Users can view all likes"
  ON post_likes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can like posts"
  ON post_likes FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email')::text = user_id);

CREATE POLICY "Users can unlike posts"
  ON post_likes FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email')::text = user_id);

-- Policies for post_comments
CREATE POLICY "Users can view all comments"
  ON post_comments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can add comments"
  ON post_comments FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email')::text = user_id);

CREATE POLICY "Users can delete own comments"
  ON post_comments FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email')::text = user_id);

-- Function to update post likes count
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes = likes + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes = likes - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update post comments count
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments = comments + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments = comments - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER update_post_likes_count_trigger
AFTER INSERT OR DELETE ON post_likes
FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

CREATE TRIGGER update_post_comments_count_trigger
AFTER INSERT OR DELETE ON post_comments
FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();