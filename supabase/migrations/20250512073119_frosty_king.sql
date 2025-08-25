/*
  # Debug notifications for questions and answers
  
  1. Changes
    - Add more detailed logging to notification functions
    - Fix potential issues with notification creation
    - Ensure proper error handling
    
  2. Security
    - Maintain existing security model
*/

-- Update function to notify coin owner when a question is asked
CREATE OR REPLACE FUNCTION notify_question_asked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coin_owner text;
  v_questioner_username text;
  v_coin_name text;
  v_notification_id uuid;
BEGIN
  -- Get coin owner's email and coin name
  SELECT "UserId", "Coin Name" INTO v_coin_owner, v_coin_name
  FROM "Challenge Coin Table"
  WHERE id = NEW.coin_id;

  -- Get username of the person asking the question
  SELECT "Username" INTO v_questioner_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

  -- Log detailed information for debugging
  RAISE LOG 'Creating question notification: 
    Coin ID: %, 
    Owner Email: %, 
    Questioner: %, 
    Question: %, 
    Question ID: %', 
    NEW.coin_id, v_coin_owner, v_questioner_username, NEW.question, NEW.id;

  -- Validate data before inserting notification
  IF v_coin_owner IS NULL THEN
    RAISE LOG 'Error: Coin owner not found for coin ID %', NEW.coin_id;
    RETURN NEW;
  END IF;

  IF v_questioner_username IS NULL THEN
    RAISE LOG 'Error: Questioner username not found for email %', NEW.user_id;
    RETURN NEW;
  END IF;

  -- Insert notification for coin owner
  INSERT INTO notifications (
    recipient_id,
    type,
    content,
    reference_id,
    reference_type,
    metadata
  )
  VALUES (
    v_coin_owner,
    'new_question',
    format('%s asked a question about your coin: %s', v_questioner_username, v_coin_name),
    NEW.coin_id::text,
    'coin',
    jsonb_build_object(
      'question_id', NEW.id,
      'question', NEW.question,
      'coin_id', NEW.coin_id,
      'coin_name', v_coin_name,
      'actor_username', v_questioner_username,
      'user_id', NEW.user_id
    )
  )
  RETURNING id INTO v_notification_id;
  
  RAISE LOG 'Notification created with ID: %', v_notification_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in notify_question_asked: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Update function to notify question asker when their question is answered
CREATE OR REPLACE FUNCTION notify_answer_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_questioner text;
  v_coin_name text;
  v_answerer_username text;
  v_coin_id bigint;
  v_notification_id uuid;
BEGIN
  -- Only trigger when answer is added
  IF OLD.answer IS NULL AND NEW.answer IS NOT NULL THEN
    -- Get question asker's email
    v_questioner := NEW.user_id;
    v_coin_id := NEW.coin_id;

    -- Get coin name
    SELECT "Coin Name" INTO v_coin_name
    FROM "Challenge Coin Table"
    WHERE id = v_coin_id;

    -- Get username of the person answering
    SELECT "Username" INTO v_answerer_username
    FROM "User Dps"
    WHERE email = NEW.answered_by;

    -- Log detailed information for debugging
    RAISE LOG 'Creating answer notification: 
      Question ID: %, 
      Coin ID: %, 
      Questioner Email: %, 
      Answerer: %, 
      Answer: %', 
      NEW.id, v_coin_id, v_questioner, v_answerer_username, NEW.answer;

    -- Validate data before inserting notification
    IF v_questioner IS NULL THEN
      RAISE LOG 'Error: Questioner email not found for question ID %', NEW.id;
      RETURN NEW;
    END IF;

    IF v_answerer_username IS NULL THEN
      RAISE LOG 'Error: Answerer username not found for email %', NEW.answered_by;
      RETURN NEW;
    END IF;

    -- Insert notification
    INSERT INTO notifications (
      recipient_id,
      type,
      content,
      reference_id,
      reference_type,
      metadata
    )
    VALUES (
      v_questioner,
      'answer_added',
      format('Your question about %s has been answered by %s', v_coin_name, v_answerer_username),
      v_coin_id::text,
      'coin',
      jsonb_build_object(
        'question_id', NEW.id,
        'coin_id', v_coin_id,
        'coin_name', v_coin_name,
        'answer', NEW.answer,
        'actor_username', v_answerer_username
      )
    )
    RETURNING id INTO v_notification_id;
    
    RAISE LOG 'Notification created with ID: %', v_notification_id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in notify_answer_added: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate triggers to ensure they use the updated functions
DROP TRIGGER IF EXISTS notify_question_asked_trigger ON coin_questions;
CREATE TRIGGER notify_question_asked_trigger
AFTER INSERT ON coin_questions
FOR EACH ROW
EXECUTE FUNCTION notify_question_asked();

DROP TRIGGER IF EXISTS notify_answer_added_trigger ON coin_questions;
CREATE TRIGGER notify_answer_added_trigger
AFTER UPDATE ON coin_questions
FOR EACH ROW
EXECUTE FUNCTION notify_answer_added();

-- Create notification settings for users who don't have them
INSERT INTO notification_settings (user_id, events_enabled, coins_enabled, social_enabled)
SELECT email, true, true, true
FROM "User Dps"
WHERE email NOT IN (SELECT user_id FROM notification_settings)
ON CONFLICT (user_id) DO NOTHING;

-- Log existing notification settings for debugging
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE 'Current notification settings:';
  FOR r IN (SELECT * FROM notification_settings) LOOP
    RAISE NOTICE 'User: %, Events: %, Coins: %, Social: %', 
      r.user_id, r.events_enabled, r.coins_enabled, r.social_enabled;
  END LOOP;
END $$;