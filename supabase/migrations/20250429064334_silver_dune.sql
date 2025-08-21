/*
  # Fix social notifications for likes
  
  1. Changes
    - Update social notification function to handle likes properly
    - Fix content access in trigger function
    
  2. Security
    - Maintain existing security model
*/

-- Update social notification function to fix like functionality
CREATE OR REPLACE FUNCTION create_social_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username text;
  v_post_owner text;
  v_post_content text;
  v_notification_id uuid;
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

  -- Create notification if social notifications are enabled or not set
  IF NOT EXISTS (
    SELECT 1 FROM notification_settings 
    WHERE user_id = v_post_owner 
    AND social_enabled = false
  ) THEN
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
    )
    RETURNING id INTO v_notification_id;
  END IF;

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