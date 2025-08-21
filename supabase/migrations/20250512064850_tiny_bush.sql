/*
  # Add coin questions functionality
  
  1. New Tables
    - coin_questions: Store questions and answers about coins
    
  2. New Notification Types
    - new_question: When someone asks a question about a coin
    - answer_added: When a question gets answered
    
  3. Security
    - RLS enabled with proper policies
    - Triggers for notifications
*/

-- Create coin_questions table
CREATE TABLE IF NOT EXISTS coin_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coin_id bigint REFERENCES "Challenge Coin Table"(id) ON DELETE CASCADE,
  user_id text REFERENCES "User Dps"(email) ON DELETE CASCADE,
  question text NOT NULL,
  answer text,
  created_at timestamptz DEFAULT now(),
  answered_at timestamptz,
  answered_by text REFERENCES "User Dps"(email) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE coin_questions ENABLE ROW LEVEL SECURITY;

-- Create policies for coin_questions
CREATE POLICY "Users can view questions for public coins"
  ON coin_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Challenge Coin Table"
      WHERE id = coin_id
      AND "Public Display" = true
    )
  );

CREATE POLICY "Users can view questions for their own coins"
  ON coin_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Challenge Coin Table"
      WHERE id = coin_id
      AND "UserId" = (auth.jwt() ->> 'email')::text
    )
  );

CREATE POLICY "Users can ask questions"
  ON coin_questions FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email')::text = user_id);

CREATE POLICY "Coin owners can answer questions"
  ON coin_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Challenge Coin Table"
      WHERE id = coin_id
      AND "UserId" = (auth.jwt() ->> 'email')::text
    )
  );

-- Update notifications table to allow new notification types
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE notifications
    DROP CONSTRAINT notifications_type_check;
  END IF;
END $$;

-- Add updated constraint with new notification types
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN ('new_event', 'new_coin', 'post_like', 'post_comment', 'new_post', 'comment_like', 'public_coin', 'new_question', 'answer_added'));

-- Trigger function to notify coin owner when a question is asked
CREATE OR REPLACE FUNCTION notify_question_asked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coin_owner text;
  v_questioner_username text;
  v_coin_name text;
BEGIN
  -- Get coin owner's email and coin name
  SELECT "UserId", "Coin Name" INTO v_coin_owner, v_coin_name
  FROM "Challenge Coin Table"
  WHERE id = NEW.coin_id;

  -- Get username of the person asking the question
  SELECT "Username" INTO v_questioner_username
  FROM "User Dps"
  WHERE email = NEW.user_id;

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
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in notify_question_asked: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for new questions
CREATE TRIGGER notify_question_asked_trigger
AFTER INSERT ON coin_questions
FOR EACH ROW
EXECUTE FUNCTION notify_question_asked();

-- Trigger function to notify question asker when their question is answered
CREATE OR REPLACE FUNCTION notify_answer_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_questioner text;
  v_coin_name text;
  v_answerer_username text;
BEGIN
  -- Only trigger when answer is added
  IF OLD.answer IS NULL AND NEW.answer IS NOT NULL THEN
    -- Get question asker's email
    v_questioner := NEW.user_id;

    -- Get coin name
    SELECT "Coin Name" INTO v_coin_name
    FROM "Challenge Coin Table"
    WHERE id = NEW.coin_id;

    -- Get username of the person answering
    SELECT "Username" INTO v_answerer_username
    FROM "User Dps"
    WHERE email = NEW.answered_by;

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
      NEW.coin_id::text,
      'coin',
      jsonb_build_object(
        'question_id', NEW.id,
        'coin_id', NEW.coin_id,
        'coin_name', v_coin_name,
        'answer', NEW.answer,
        'actor_username', v_answerer_username
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in notify_answer_added: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for new answers
CREATE TRIGGER notify_answer_added_trigger
AFTER UPDATE ON coin_questions
FOR EACH ROW
EXECUTE FUNCTION notify_answer_added();