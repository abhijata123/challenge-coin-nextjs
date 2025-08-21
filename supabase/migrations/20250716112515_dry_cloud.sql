/*
  # Update notification functions to send push notifications

  1. Updates existing notification functions to call the push notification Edge Function
  2. Adds push notification support for all notification types
  3. Maintains existing functionality while adding push notifications
*/

-- Function to send push notification via Edge Function
CREATE OR REPLACE FUNCTION send_push_notification(
  p_recipient_email text,
  p_title text,
  p_message text,
  p_url text DEFAULT NULL,
  p_type text DEFAULT 'general'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response text;
BEGIN
  -- Call the Supabase Edge Function to send push notification
  SELECT content INTO v_response
  FROM http((
    'POST',
    current_setting('app.settings.supabase_url') || '/functions/v1/send-push-notification',
    ARRAY[
      http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    json_build_object(
      'recipient_email', p_recipient_email,
      'title', p_title,
      'message', p_message,
      'url', COALESCE(p_url, 'https://coins.braav.co/notifications'),
      'type', p_type
    )::text
  ));
  
  -- Log the response (optional, for debugging)
  -- RAISE NOTICE 'Push notification response: %', v_response;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the main operation
    RAISE NOTICE 'Failed to send push notification: %', SQLERRM;
END;
$$;

-- Update create_event_notification function
CREATE OR REPLACE FUNCTION create_event_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_content text;
  host_username text;
BEGIN
  -- Get host username
  SELECT "Username" INTO host_username
  FROM "User Dps"
  WHERE email = NEW.host_id;

  notification_content := 'New event "' || NEW.title || '" has been created by ' || COALESCE(host_username, 'someone');

  -- Insert notification for all users with events enabled
  INSERT INTO notifications (recipient_id, type, content, reference_id, reference_type, metadata)
  SELECT 
    ud.email,
    'new_event',
    notification_content,
    NEW.id::text,
    'event',
    json_build_object(
      'event_title', NEW.title,
      'event_date', NEW.date,
      'event_location', NEW.location,
      'host_username', host_username
    )
  FROM "User Dps" ud
  JOIN notification_settings ns ON ud.email = ns.user_id
  WHERE ns.events_enabled = true
    AND ud.email != NEW.host_id; -- Don't notify the host

  -- Send push notifications to all users with events enabled
  PERFORM send_push_notification(
    ud.email,
    'New Event Created',
    notification_content,
    'https://coins.braav.co/events',
    'new_event'
  )
  FROM "User Dps" ud
  JOIN notification_settings ns ON ud.email = ns.user_id
  WHERE ns.events_enabled = true
    AND ud.email != NEW.host_id;

  RETURN NEW;
END;
$$;

-- Update create_coin_notification function
CREATE OR REPLACE FUNCTION create_coin_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_content text;
  coin_owner_username text;
BEGIN
  -- Get coin owner username
  SELECT "Username" INTO coin_owner_username
  FROM "User Dps"
  WHERE email = NEW."UserId";

  notification_content := COALESCE(coin_owner_username, 'Someone') || ' added a new coin: "' || NEW."Coin Name" || '"';

  -- Insert notification for all users with coins enabled
  INSERT INTO notifications (recipient_id, type, content, reference_id, reference_type, metadata)
  SELECT 
    ud.email,
    'new_coin',
    notification_content,
    NEW.id::text,
    'coin',
    json_build_object(
      'coin_name', NEW."Coin Name",
      'coin_image', NEW."Coin Image",
      'owner_username', coin_owner_username,
      'is_public', NEW."Public Display"
    )
  FROM "User Dps" ud
  JOIN notification_settings ns ON ud.email = ns.user_id
  WHERE ns.coins_enabled = true
    AND ud.email != NEW."UserId"; -- Don't notify the owner

  -- Send push notifications to all users with coins enabled
  PERFORM send_push_notification(
    ud.email,
    'New Coin Added',
    notification_content,
    'https://coins.braav.co/forum',
    'new_coin'
  )
  FROM "User Dps" ud
  JOIN notification_settings ns ON ud.email = ns.user_id
  WHERE ns.coins_enabled = true
    AND ud.email != NEW."UserId";

  RETURN NEW;
END;
$$;

-- Update notify_public_coin function
CREATE OR REPLACE FUNCTION notify_public_coin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_content text;
  coin_owner_username text;
  public_url text;
BEGIN
  -- Only proceed if Public Display changed from false to true
  IF OLD."Public Display" = false AND NEW."Public Display" = true THEN
    -- Get coin owner username
    SELECT "Username" INTO coin_owner_username
    FROM "User Dps"
    WHERE email = NEW."UserId";

    notification_content := COALESCE(coin_owner_username, 'Someone') || ' made their coin "' || NEW."Coin Name" || '" public';
    public_url := 'https://coins.braav.co/collection/' || coin_owner_username || '/coin/' || NEW.id;

    -- Insert notification for all users with coins enabled
    INSERT INTO notifications (recipient_id, type, content, reference_id, reference_type, metadata)
    SELECT 
      ud.email,
      'public_coin',
      notification_content,
      NEW.id::text,
      'coin',
      json_build_object(
        'coin_name', NEW."Coin Name",
        'coin_image', NEW."Coin Image",
        'owner_username', coin_owner_username,
        'public_url', public_url,
        'is_public', true,
        'made_public_at', NOW()
      )
    FROM "User Dps" ud
    JOIN notification_settings ns ON ud.email = ns.user_id
    WHERE ns.coins_enabled = true
      AND ud.email != NEW."UserId"; -- Don't notify the owner

    -- Send push notifications to all users with coins enabled
    PERFORM send_push_notification(
      ud.email,
      'Coin Made Public',
      notification_content,
      public_url,
      'public_coin'
    )
    FROM "User Dps" ud
    JOIN notification_settings ns ON ud.email = ns.user_id
    WHERE ns.coins_enabled = true
      AND ud.email != NEW."UserId";
  END IF;

  RETURN NEW;
END;
$$;

-- Update create_social_notification function
CREATE OR REPLACE FUNCTION create_social_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_content text;
  actor_username text;
  post_owner_email text;
  notification_type text;
  reference_type text;
  push_title text;
  push_url text;
BEGIN
  -- Get actor username
  SELECT "Username" INTO actor_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Determine notification type and content based on the table
  IF TG_TABLE_NAME = 'post_likes' THEN
    -- Get post owner
    SELECT user_id INTO post_owner_email
    FROM posts
    WHERE id = NEW.post_id;
    
    notification_type := 'post_like';
    reference_type := 'post';
    notification_content := COALESCE(actor_username, 'Someone') || ' liked your post';
    push_title := 'Post Liked';
    push_url := 'https://coins.braav.co/';
    
  ELSIF TG_TABLE_NAME = 'post_comments' THEN
    -- Get post owner
    SELECT user_id INTO post_owner_email
    FROM posts
    WHERE id = NEW.post_id;
    
    notification_type := 'post_comment';
    reference_type := 'post';
    notification_content := COALESCE(actor_username, 'Someone') || ' commented on your post';
    push_title := 'New Comment';
    push_url := 'https://coins.braav.co/';
    
  ELSIF TG_TABLE_NAME = 'comment_likes' THEN
    -- Get comment owner
    SELECT user_id INTO post_owner_email
    FROM post_comments
    WHERE id = NEW.comment_id;
    
    notification_type := 'comment_like';
    reference_type := 'comment';
    notification_content := COALESCE(actor_username, 'Someone') || ' liked your comment';
    push_title := 'Comment Liked';
    push_url := 'https://coins.braav.co/';
  END IF;

  -- Only create notification if there's a recipient and it's not self-action
  IF post_owner_email IS NOT NULL AND post_owner_email != NEW.user_id THEN
    -- Check if recipient has social notifications enabled
    IF EXISTS (
      SELECT 1 FROM notification_settings 
      WHERE user_id = post_owner_email AND social_enabled = true
    ) THEN
      -- Insert notification
      INSERT INTO notifications (recipient_id, type, content, reference_id, reference_type, metadata)
      VALUES (
        post_owner_email,
        notification_type,
        notification_content,
        COALESCE(NEW.post_id::text, NEW.comment_id::text),
        reference_type,
        json_build_object(
          'actor_username', actor_username,
          'action_type', notification_type
        )
      );

      -- Send push notification
      PERFORM send_push_notification(
        post_owner_email,
        push_title,
        notification_content,
        push_url,
        notification_type
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Update notify_question_asked function
CREATE OR REPLACE FUNCTION notify_question_asked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_content text;
  asker_username text;
  coin_owner_email text;
  coin_name text;
  coin_owner_username text;
  question_url text;
BEGIN
  -- Get asker username
  SELECT "Username" INTO asker_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Get coin details and owner
  SELECT cc."UserId", cc."Coin Name", ud."Username"
  INTO coin_owner_email, coin_name, coin_owner_username
  FROM "Challenge Coin Table" cc
  JOIN "User Dps" ud ON cc."UserId" = ud.email
  WHERE cc.id = NEW.coin_id;

  -- Only notify if the question asker is not the coin owner
  IF coin_owner_email IS NOT NULL AND coin_owner_email != NEW.user_id THEN
    notification_content := COALESCE(asker_username, 'Someone') || ' asked a question about your coin "' || coin_name || '"';
    question_url := 'https://coins.braav.co/collection/' || coin_owner_username || '/coin/' || NEW.coin_id;

    -- Insert notification
    INSERT INTO notifications (recipient_id, type, content, reference_id, reference_type, metadata)
    VALUES (
      coin_owner_email,
      'new_question',
      notification_content,
      NEW.coin_id::text,
      'coin',
      json_build_object(
        'question_id', NEW.id,
        'question', NEW.question,
        'asker_username', asker_username,
        'coin_name', coin_name,
        'coin_owner_username', coin_owner_username
      )
    );

    -- Send push notification
    PERFORM send_push_notification(
      coin_owner_email,
      'New Question About Your Coin',
      notification_content,
      question_url,
      'new_question'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Update notify_answer_added function
CREATE OR REPLACE FUNCTION notify_answer_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_content text;
  answerer_username text;
  coin_name text;
  coin_owner_username text;
  answer_url text;
BEGIN
  -- Only proceed if answer was added (not just question created)
  IF OLD.answer IS NULL AND NEW.answer IS NOT NULL THEN
    -- Get answerer username
    SELECT "Username" INTO answerer_username
    FROM "User Dps"
    WHERE email = NEW.answered_by;

    -- Get coin details
    SELECT cc."Coin Name", ud."Username"
    INTO coin_name, coin_owner_username
    FROM "Challenge Coin Table" cc
    JOIN "User Dps" ud ON cc."UserId" = ud.email
    WHERE cc.id = NEW.coin_id;

    -- Only notify if the answerer is not the question asker
    IF NEW.answered_by != NEW.user_id THEN
      notification_content := COALESCE(answerer_username, 'Someone') || ' answered your question about "' || coin_name || '"';
      answer_url := 'https://coins.braav.co/collection/' || coin_owner_username || '/coin/' || NEW.coin_id;

      -- Insert notification
      INSERT INTO notifications (recipient_id, type, content, reference_id, reference_type, metadata)
      VALUES (
        NEW.user_id,
        'answer_added',
        notification_content,
        NEW.coin_id::text,
        'coin',
        json_build_object(
          'question_id', NEW.id,
          'question', NEW.question,
          'answer', NEW.answer,
          'answerer_username', answerer_username,
          'coin_name', coin_name,
          'coin_owner_username', coin_owner_username
        )
      );

      -- Send push notification
      PERFORM send_push_notification(
        NEW.user_id,
        'Your Question Was Answered',
        notification_content,
        answer_url,
        'answer_added'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;