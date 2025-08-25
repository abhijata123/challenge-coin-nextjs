/*
  # Create posts table with open policies
  
  1. New Tables
    - posts: Store user posts with content and media
    
  2. Security
    - Open policies for all operations
    - Public storage bucket for post images
*/

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text,
  image_url text,
  created_at timestamptz DEFAULT now(),
  likes integer DEFAULT 0,
  comments integer DEFAULT 0
);

-- Add foreign key reference
ALTER TABLE posts
ADD CONSTRAINT posts_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create open policies for all operations
CREATE POLICY "Open policy for posts"
  ON posts
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create storage bucket for post images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up open storage policies
CREATE POLICY "Open policy for post images"
  ON storage.objects
  FOR ALL
  TO public
  USING (bucket_id = 'post-images')
  WITH CHECK (bucket_id = 'post-images');