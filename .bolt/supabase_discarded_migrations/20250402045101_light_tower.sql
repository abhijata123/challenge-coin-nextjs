/*
  # Add posts table and functions
  
  1. New Tables
    - `posts`
      - `id` (uuid, primary key)
      - `user_id` (text, references auth.users)
      - `content` (text)
      - `image_url` (text)
      - `created_at` (timestamp)
      - `likes` (integer)
      - `comments` (integer)
      
  2. Security
    - Enable RLS
    - Add policies for read/write access
*/

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  content text,
  image_url text,
  created_at timestamptz DEFAULT now(),
  likes integer DEFAULT 0,
  comments integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read posts"
  ON posts
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can create posts"
  ON posts
  FOR INSERT
  TO public
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own posts"
  ON posts
  FOR UPDATE
  TO public
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own posts"
  ON posts
  FOR DELETE
  TO public
  USING (auth.uid()::text = user_id);

-- Create storage bucket for post images if it doesn't exist
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('post-images', 'post-images', true)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Set up storage policies
CREATE POLICY "Anyone can view post images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'post-images');

CREATE POLICY "Authenticated users can upload post images"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (
    bucket_id = 'post-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own post images"
  ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id = 'post-images' AND auth.uid()::text = owner)
  WITH CHECK (bucket_id = 'post-images' AND auth.uid()::text = owner);

CREATE POLICY "Users can delete their own post images"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'post-images' AND auth.uid()::text = owner);