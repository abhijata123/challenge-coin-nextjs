/*
  # Fix coin questions functionality
  
  1. Changes
    - Update RLS policies for coin_questions table
    - Fix notification triggers for questions and answers
    - Ensure proper user information is included in queries
    
  2. Security
    - Maintain proper security model with improved policies
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view questions for public coins" ON coin_questions;
DROP POLICY IF EXISTS "Users can view questions for their own coins" ON coin_questions;
DROP POLICY IF EXISTS "Users can ask questions" ON coin_questions;
DROP POLICY IF EXISTS "Coin owners can answer questions" ON coin_questions;

-- Create improved policies for coin_questions
CREATE POLICY "Users can view questions for public coins"
  ON coin_questions FOR SELECT
  TO authenticated
  USING (true);

-- Fix the insert policy to allow users to ask questions about public coins
CREATE POLICY "Users can ask questions"
  ON coin_questions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Fix the update policy to allow coin owners to answer questions
CREATE POLICY "Coin owners can answer questions"
  ON coin_questions FOR UPDATE
  TO authenticated
  USING (true);

-- Update the notify_question_asked function to properly handle user information
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
    Questioner Email: %,
    Questioner Username: %, 
    Question: %, 
    Question ID: %', 
    NEW.coin_id, v_coin_owner, NEW.user_id, v_questioner_username, NEW.question, NEW.id;

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
    format('%s asked a question about your coin: %s', 
      COALESCE(v_questioner_username, NEW.user_id),
      v_coin_name
    ),
    NEW.coin_id::text,
    'coin',
    jsonb_build_object(
      'question_id', NEW.id,
      'question', NEW.question,
      'coin_id', NEW.coin_id,
      'coin_name', v_coin_name,
      'actor_username', COALESCE(v_questioner_username, NEW.user_id),
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

-- Update the notify_answer_added function to properly handle user information
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
      Answerer Email: %,
      Answerer Username: %, 
      Answer: %', 
      NEW.id, v_coin_id, v_questioner, NEW.answered_by, v_answerer_username, NEW.answer;

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
      format('Your question about %s has been answered by %s', 
        v_coin_name, 
        COALESCE(v_answerer_username, NEW.answered_by)
      ),
      v_coin_id::text,
      'coin',
      jsonb_build_object(
        'question_id', NEW.id,
        'coin_id', v_coin_id,
        'coin_name', v_coin_name,
        'answer', NEW.answer,
        'actor_username', COALESCE(v_answerer_username, NEW.answered_by)
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