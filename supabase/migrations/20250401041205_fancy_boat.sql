/*
  # Add followers and notifications system
  
  1. New Tables
    - followers: Track user follows
    - notifications: Store user notifications
    
  2. Security
    - Enable RLS for both tables
    - Add appropriate policies
    - Add notification trigger for new coins
*/

-- Drop existing objects if they exist
DROP TRIGGER IF EXISTS notify_followers_trigger ON "Challenge Coin Table";
DROP FUNCTION IF EXISTS notify_followers();
DROP POLICY IF EXISTS "Users can see who they follow and who follows them" ON followers;
DROP POLICY IF EXISTS "Users can follow others" ON followers;
DROP POLICY IF EXISTS "Users can unfollow" ON followers;
DROP POLICY IF EXISTS "Users can see their own notifications" ON notifications;

-- Create or update tables
CREATE TABLE IF NOT EXISTS followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id text NOT NULL,
  following_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  type text NOT NULL,
  content text NOT NULL,
  coin_id bigint REFERENCES "Challenge Coin Table"(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  read boolean DEFAULT false
);

-- Enable RLS
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can see who they follow and who follows them"
  ON followers
  FOR SELECT
  TO public
  USING (
    auth.uid()::text IN (follower_id, following_id)
  );

CREATE POLICY "Users can follow others"
  ON followers
  FOR INSERT
  TO public
  WITH CHECK (
    auth.uid()::text = follower_id
  );

CREATE POLICY "Users can unfollow"
  ON followers
  FOR DELETE
  TO public
  USING (
    auth.uid()::text = follower_id
  );

CREATE POLICY "Users can see their own notifications"
  ON notifications
  FOR SELECT
  TO public
  USING (
    auth.uid()::text = user_id
  );

-- Create notification function
CREATE OR REPLACE FUNCTION notify_followers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, content, coin_id)
  SELECT 
    f.follower_id,
    'new_coin',
    format('%s added a new coin: %s', NEW."Username", NEW."Coin Name"),
    NEW.id
  FROM followers f
  WHERE f.following_id = NEW."UserId";
  
  RETURN NEW;
END;
$$;

-- Create notification trigger
CREATE TRIGGER notify_followers_trigger
AFTER INSERT ON "Challenge Coin Table"
FOR EACH ROW
EXECUTE FUNCTION notify_followers();