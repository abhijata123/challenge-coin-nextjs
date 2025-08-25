-- Drop existing table if exists
DROP TABLE IF EXISTS posts CASCADE;

-- Create fresh posts table
CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  content text,
  image_url text,
  created_at timestamptz DEFAULT now(),
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES "User Dps"(email) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policies using email-based authentication
CREATE POLICY "Users can view all posts"
ON posts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create posts"
ON posts
FOR INSERT
TO authenticated
WITH CHECK ((auth.jwt() ->> 'email')::text = user_id);

CREATE POLICY "Users can update own posts"
ON posts
FOR UPDATE
TO authenticated
USING ((auth.jwt() ->> 'email')::text = user_id)
WITH CHECK ((auth.jwt() ->> 'email')::text = user_id);

CREATE POLICY "Users can delete own posts"
ON posts
FOR DELETE
TO authenticated
USING ((auth.jwt() ->> 'email')::text = user_id);