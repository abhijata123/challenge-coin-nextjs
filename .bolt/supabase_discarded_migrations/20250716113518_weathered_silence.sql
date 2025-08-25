```sql
CREATE OR REPLACE FUNCTION public.create_social_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_recipient_id text;
    v_content text;
    v_reference_id uuid;
    v_reference_type text;
    v_actor_username text;
    v_owner_email text;
    v_notification_type text;
BEGIN
    -- Get the username of the user who performed the action (liker/commenter)
    SELECT "Username" INTO v_actor_username FROM "User Dps" WHERE email = NEW.user_id;

    IF TG_TABLE_NAME = 'post_likes' THEN
        -- Action: A post was liked
        v_reference_type := 'post';
        v_reference_id := NEW.post_id;
        v_notification_type := 'post_like';
        v_content := v_actor_username || ' liked your post.';

        -- Get the owner of the post
        SELECT user_id INTO v_owner_email FROM posts WHERE id = NEW.post_id;
        v_recipient_id := v_owner_email;

    ELSIF TG_TABLE_NAME = 'post_comments' THEN
        -- Action: A comment was made on a post
        v_reference_type := 'post';
        v_reference_id := NEW.post_id;
        v_notification_type := 'post_comment';
        v_content := v_actor_username || ' commented on your post: "' || NEW.content || '"';

        -- Get the owner of the post
        SELECT user_id INTO v_owner_email FROM posts WHERE id = NEW.post_id;
        v_recipient_id := v_owner_email;

    -- NOTE: The schema indicates 'comment_likes' triggers 'notify_comment_like', not 'create_social_notification'.
    -- If this function is somehow triggered by 'comment_likes', this block would be needed.
    -- For now, assuming the schema is correct and this block is not reached by current triggers.
    -- If the error persists and is confirmed to be from 'comment_likes' triggering this,
    -- then the trigger definition for 'comment_likes' needs to be checked.
    -- ELSIF TG_TABLE_NAME = 'comment_likes' THEN
    --     v_reference_type := 'comment';
    --     v_reference_id := NEW.comment_id;
    --     v_notification_type := 'comment_like';
    --     v_content := v_actor_username || ' liked your comment.';
    --
    --     SELECT user_id INTO v_owner_email FROM post_comments WHERE id = NEW.comment_id;
    --     v_recipient_id := v_owner_email;

    ELSE
        -- This case should ideally not be reached if triggers are correctly set up.
        RAISE WARNING 'create_social_notification triggered by unexpected table: %', TG_TABLE_NAME;
        RETURN NEW;
    END IF;

    -- Only insert notification if recipient is not the actor and recipient exists
    IF v_recipient_id IS NOT NULL AND v_recipient_id != NEW.user_id THEN
        INSERT INTO notifications (recipient_id, type, content, reference_id, reference_type, metadata)
        VALUES (
            v_recipient_id,
            v_notification_type,
            v_content,
            v_reference_id,
            v_reference_type,
            jsonb_build_object('actor_username', v_actor_username)
        );
    END IF;

    RETURN NEW;
END;
$function$;
```