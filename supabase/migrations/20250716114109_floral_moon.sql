/*
  # Fix create_social_notification function

  This migration fixes the create_social_notification function to properly handle
  different trigger tables and avoid the "comment_id" field error.

  ## Changes
  1. Redefine create_social_notification function with proper table checks
  2. Only access fields that exist in the triggering table
  3. Add proper error handling and logging
*/

-- Drop and recreate the function with proper logic
CREATE OR REPLACE FUNCTION public.create_social_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    recipient_email TEXT;
    notification_type TEXT;
    notification_content TEXT;
    ref_id TEXT;
    ref_type TEXT;
    actor_username TEXT;
    owner_email TEXT;
BEGIN
    -- Get the username of the user who performed the action (actor)
    SELECT Username INTO actor_username FROM "User Dps" WHERE email = NEW.user_id;
    
    -- If we can't find the actor username, use email
    IF actor_username IS NULL THEN
        actor_username := NEW.user_id;
    END IF;

    -- Handle different trigger tables
    IF TG_TABLE_NAME = 'post_likes' THEN
        -- Action: A post was liked
        -- Recipient: The owner of the post
        SELECT user_id INTO owner_email FROM public.posts WHERE id = NEW.post_id;
        recipient_email := owner_email;
        notification_type := 'post_like';
        notification_content := actor_username || ' liked your post.';
        ref_id := NEW.post_id::TEXT;
        ref_type := 'post';

    ELSIF TG_TABLE_NAME = 'post_comments' THEN
        -- Action: A comment was made on a post
        -- Recipient: The owner of the post
        SELECT user_id INTO owner_email FROM public.posts WHERE id = NEW.post_id;
        recipient_email := owner_email;
        notification_type := 'post_comment';
        notification_content := actor_username || ' commented on your post.';
        ref_id := NEW.post_id::TEXT;
        ref_type := 'post';

    ELSIF TG_TABLE_NAME = 'comment_likes' THEN
        -- Action: A comment was liked
        -- Recipient: The owner of the comment
        SELECT user_id INTO owner_email FROM public.post_comments WHERE id = NEW.comment_id;
        recipient_email := owner_email;
        notification_type := 'comment_like';
        notification_content := actor_username || ' liked your comment.';
        ref_id := NEW.comment_id::TEXT;
        ref_type := 'comment';

    ELSE
        -- If the trigger is fired from an unexpected table, log and exit
        RAISE WARNING 'create_social_notification triggered by unhandled table: %', TG_TABLE_NAME;
        RETURN NEW;
    END IF;

    -- Only create notification if recipient exists and is not the actor
    IF recipient_email IS NOT NULL AND recipient_email != NEW.user_id THEN
        -- Check if user has social notifications enabled
        IF EXISTS (
            SELECT 1 FROM notification_settings 
            WHERE user_id = recipient_email AND social_enabled = true
        ) THEN
            -- Insert the notification
            INSERT INTO public.notifications (
                recipient_id, 
                type, 
                content, 
                reference_id, 
                reference_type, 
                metadata
            )
            VALUES (
                recipient_email, 
                notification_type, 
                notification_content, 
                ref_id, 
                ref_type, 
                jsonb_build_object('actor_username', actor_username)
            );

            -- Send push notification
            PERFORM send_push_notification(
                recipient_email,
                'New Social Activity',
                notification_content,
                'social'
            );
        END IF;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the original operation
        RAISE WARNING 'Error in create_social_notification: %', SQLERRM;
        RETURN NEW;
END;
$function$;

-- Ensure triggers are properly set up
DROP TRIGGER IF EXISTS create_social_notification_trigger_likes ON post_likes;
DROP TRIGGER IF EXISTS create_social_notification_trigger_comments ON post_comments;
DROP TRIGGER IF EXISTS create_social_notification_trigger_comment_likes ON comment_likes;

-- Recreate triggers
CREATE TRIGGER create_social_notification_trigger_likes
    AFTER INSERT ON post_likes
    FOR EACH ROW
    EXECUTE FUNCTION create_social_notification();

CREATE TRIGGER create_social_notification_trigger_comments
    AFTER INSERT ON post_comments
    FOR EACH ROW
    EXECUTE FUNCTION create_social_notification();

CREATE TRIGGER create_social_notification_trigger_comment_likes
    AFTER INSERT ON comment_likes
    FOR EACH ROW
    EXECUTE FUNCTION create_social_notification();