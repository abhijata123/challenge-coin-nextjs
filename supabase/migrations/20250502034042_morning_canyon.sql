/*
  # Add comment likes functionality
  
  1. New Tables
    - comment_likes: Track user likes on comments
    
  2. Changes
    - Add notification type for comment likes
    - Add trigger for comment like notifications
    
  3. Security
    - RLS enabled with proper policies
*/

-- Create comment_likes table
CREATE TABLE comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id text REFERENCES "User Dps"(email) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Enable RLS
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- Policies for comment_likes
CREATE POLICY "Users can view all comment likes"
  ON comment_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can like comments"
  ON comment_likes FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email')::text = user_id);

CREATE POLICY "Users can unlike comments"
  ON comment_likes FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'email')::text = user_id);

-- Add likes count to post_comments table
ALTER TABLE post_comments
ADD COLUMN IF NOT EXISTS likes integer DEFAULT 0;

-- Function to update comment likes count
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE post_comments SET likes = likes + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE post_comments SET likes = likes - 1 WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for comment likes count
CREATE TRIGGER update_comment_likes_count_trigger
AFTER INSERT OR DELETE ON comment_likes
FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();

-- Update notifications table to allow comment_like type
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN ('new_event', 'new_coin', 'post_like', 'post_comment', 'new_post', 'comment_like'));

-- Function to create notification for comment like
CREATE OR REPLACE FUNCTION notify_comment_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username text;
  v_comment_owner text;
  v_comment_content text;
  v_post_id uuid;
BEGIN
  -- Get username of liker
  SELECT "Username" INTO v_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Get comment details
  SELECT 
    user_id,
    COALESCE(content, ''),
    post_id
  INTO v_comment_owner, v_comment_content, v_post_id
  FROM post_comments
  WHERE id = NEW.comment_id;

  -- Don't create notification if user is liking their own comment
  IF v_comment_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Create notification
  INSERT INTO notifications (
    recipient_id,
    type,
    content,
    reference_id,
    reference_type,
    metadata
  )
  VALUES (
    v_comment_owner,
    'comment_like',
    CASE 
      WHEN v_comment_content = '' THEN
        format('%s liked your comment', v_username)
      ELSE
        format('%s liked your comment: "%s%s"', 
          v_username,
          SUBSTRING(v_comment_content FROM 1 FOR 50),
          CASE WHEN LENGTH(v_comment_content) > 50 THEN '...' ELSE '' END
        )
    END,
    NEW.comment_id::text,
    'comment',
    jsonb_build_object(
      'post_id', v_post_id,
      'comment_id', NEW.comment_id,
      'comment_content', v_comment_content,
      'username', v_username,
      'user_id', NEW.user_id
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger for comment like notifications
CREATE TRIGGER notify_comment_like_trigger
AFTER INSERT ON comment_likes
FOR EACH ROW
EXECUTE FUNCTION notify_comment_like();