/*
  # Add follow system and notifications

  1. New Tables
    - `followers`
      - `id` (uuid, primary key)
      - `follower_id` (text, references User Dps)
      - `following_id` (text, references User Dps)
      - `created_at` (timestamp)
    
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (text, references User Dps)
      - `type` (text)
      - `content` (text)
      - `coin_id` (bigint, references Challenge Coin Table)
      - `created_at` (timestamp)
      - `read` (boolean)

  2. Security
    - RLS enabled for both tables
    - Policies for read/write access
*/

-- Create followers table
CREATE TABLE IF NOT EXISTS followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id text NOT NULL,
  following_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Create notifications table
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

-- Policies for followers table
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

-- Policies for notifications table
CREATE POLICY "Users can see their own notifications"
  ON notifications
  FOR SELECT
  TO public
  USING (
    auth.uid()::text = user_id
  );

-- Function to create notification for followers when a new coin is added
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

-- Create trigger for new coin notifications
CREATE TRIGGER notify_followers_trigger
AFTER INSERT ON "Challenge Coin Table"
FOR EACH ROW
EXECUTE FUNCTION notify_followers();