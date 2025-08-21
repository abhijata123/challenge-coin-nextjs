/*
  # Fix social notifications function

  1. Function Updates
    - Restore proper `create_social_notification` function
    - Add proper table name checking to prevent column access errors
    - Handle post_likes, post_comments, and comment_likes tables correctly
    
  2. Security
    - Maintains SECURITY DEFINER for proper permissions
    - Prevents self-notifications
    
  3. Changes
    - Fixed the function that was broken during the push notification revert
    - Ensures notifications are created for likes and comments again
*/

CREATE OR REPLACE FUNCTION public.create_social_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    recipient_email TEXT;
    notification_type TEXT;
    notification_content TEXT;
    ref_id UUID;
    ref_type TEXT;
    actor_username TEXT;
    owner_email TEXT;
BEGIN
    -- Get the username of the user who performed the action (actor)
    SELECT Username INTO actor_username FROM "User Dps" WHERE email = NEW.user_id;

    IF TG_TABLE_NAME = 'post_likes' THEN
        -- Action: A post was liked
        -- Recipient: The owner of the post
        SELECT user_id INTO owner_email FROM public.posts WHERE id = NEW.post_id;
        recipient_email := owner_email;
        notification_type := 'post_like';
        notification_content := actor_username || ' liked your post.';
        ref_id := NEW.post_id;
        ref_type := 'post';

    ELSIF TG_TABLE_NAME = 'post_comments' THEN
        -- Action: A comment was made on a post
        -- Recipient: The owner of the post
        SELECT user_id INTO owner_email FROM public.posts WHERE id = NEW.post_id;
        recipient_email := owner_email;
        notification_type := 'post_comment';
        notification_content := actor_username || ' commented on your post.';
        ref_id := NEW.post_id;
        ref_type := 'post';

    ELSIF TG_TABLE_NAME = 'comment_likes' THEN
        -- Action: A comment was liked
        -- Recipient: The owner of the comment
        SELECT user_id INTO owner_email FROM public.post_comments WHERE id = NEW.comment_id;
        recipient_email := owner_email;
        notification_type := 'comment_like';
        notification_content := actor_username || ' liked your comment.';
        ref_id := NEW.comment_id;
        ref_type := 'comment';

    ELSE
        -- If the trigger is fired from an unexpected table, log a warning and do nothing.
        RAISE WARNING 'create_social_notification triggered by unhandled table: %', TG_TABLE_NAME;
        RETURN NULL; -- Do not create a notification
    END IF;

    -- Ensure recipient is not the actor (don't notify self)
    IF recipient_email IS NOT NULL AND recipient_email != NEW.user_id THEN
        INSERT INTO public.notifications (recipient_id, type, content, reference_id, reference_type, metadata)
        VALUES (recipient_email, notification_type, notification_content, ref_id::TEXT, ref_type, jsonb_build_object('actor_username', actor_username));
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't break the original operation
        RAISE WARNING 'Error in create_social_notification: %', SQLERRM;
        RETURN NEW;
END;
$function$;