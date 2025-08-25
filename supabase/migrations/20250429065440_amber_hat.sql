/*
  # Fix notifications foreign key constraint
  
  1. Changes
    - Update notifications table to use email as recipient_id
    - Update notification functions to handle email references
    
  2. Security
    - Maintain existing security model
*/

-- Drop existing notifications table and recreate with correct references
DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id text NOT NULL REFERENCES "User Dps"(email) ON DELETE CASCADE,
  type text NOT NULL CHECK (
    type IN ('new_event', 'new_coin', 'post_like', 'post_comment', 'new_post')
  ),
  actor_id text REFERENCES "User Dps"(email) ON DELETE CASCADE,
  content text NOT NULL,
  reference_id text,
  reference_type text CHECK (
    reference_type IN ('event', 'coin', 'post', 'comment')
  ),
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT valid_reference CHECK (
    (reference_id IS NULL AND reference_type IS NULL) OR
    (reference_id IS NOT NULL AND reference_type IS NOT NULL)
  )
);

-- Recreate indexes
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_read ON notifications(read) WHERE NOT read;
CREATE INDEX idx_notifications_reference ON notifications(reference_type, reference_id);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') = recipient_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = recipient_id);

-- Update social notification function
CREATE OR REPLACE FUNCTION create_social_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username text;
  v_post_owner text;
  v_post_content text;
BEGIN
  -- Get username of actor
  SELECT "Username" INTO v_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Get post details
  SELECT 
    user_id,
    COALESCE(content, '')
  INTO v_post_owner, v_post_content
  FROM posts
  WHERE id = NEW.post_id;

  -- Don't create notification if user is interacting with their own post
  IF v_post_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Create notification
  INSERT INTO notifications (
    recipient_id,
    type,
    actor_id,
    content,
    reference_id,
    reference_type,
    metadata
  )
  VALUES (
    v_post_owner,
    CASE 
      WHEN TG_TABLE_NAME = 'post_likes' THEN 'post_like'
      ELSE 'post_comment'
    END,
    NEW.user_id,
    CASE 
      WHEN TG_TABLE_NAME = 'post_likes' THEN
        CASE 
          WHEN v_post_content = '' THEN
            format('%s liked your post', v_username)
          ELSE
            format('%s liked your post: "%s%s"', 
              v_username,
              SUBSTRING(v_post_content FROM 1 FOR 50),
              CASE WHEN LENGTH(v_post_content) > 50 THEN '...' ELSE '' END
            )
        END
      ELSE
        CASE 
          WHEN v_post_content = '' THEN
            format('%s commented on your post', v_username)
          ELSE
            format('%s commented on your post: "%s%s"', 
              v_username,
              SUBSTRING(v_post_content FROM 1 FOR 50),
              CASE WHEN LENGTH(v_post_content) > 50 THEN '...' ELSE '' END
            )
        END
    END,
    NEW.post_id::text,
    'post',
    jsonb_build_object(
      'post_id', NEW.post_id,
      'post_content', v_post_content,
      'actor_username', v_username
    )
  );

  RETURN NEW;
END;
$$;

-- Recreate triggers
DROP TRIGGER IF EXISTS create_social_notification_trigger_likes ON post_likes;
DROP TRIGGER IF EXISTS create_social_notification_trigger_comments ON post_comments;

CREATE TRIGGER create_social_notification_trigger_likes
AFTER INSERT ON post_likes
FOR EACH ROW
EXECUTE FUNCTION create_social_notification();

CREATE TRIGGER create_social_notification_trigger_comments
AFTER INSERT ON post_comments
FOR EACH ROW
EXECUTE FUNCTION create_social_notification();