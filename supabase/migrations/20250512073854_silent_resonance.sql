/*
  # Fix coin questions RLS policies
  
  1. Changes
    - Update RLS policies for coin_questions table
    - Fix issue with question submission and answering
    - Ensure proper access control for questions and answers
    
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
  USING (
    EXISTS (
      SELECT 1 FROM "Challenge Coin Table"
      WHERE id = coin_questions.coin_id
      AND "Public Display" = true
    )
  );

CREATE POLICY "Users can view questions for their own coins"
  ON coin_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Challenge Coin Table"
      WHERE id = coin_questions.coin_id
      AND "UserId" = (auth.jwt() ->> 'email')::text
    )
  );

-- Fix the insert policy to allow users to ask questions about public coins
CREATE POLICY "Users can ask questions"
  ON coin_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'email')::text = user_id
    AND
    EXISTS (
      SELECT 1 FROM "Challenge Coin Table"
      WHERE id = coin_questions.coin_id
      AND "Public Display" = true
    )
  );

-- Fix the update policy to allow coin owners to answer questions
CREATE POLICY "Coin owners can answer questions"
  ON coin_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Challenge Coin Table"
      WHERE id = coin_questions.coin_id
      AND "UserId" = (auth.jwt() ->> 'email')::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Challenge Coin Table"
      WHERE id = coin_questions.coin_id
      AND "UserId" = (auth.jwt() ->> 'email')::text
    )
  );

-- Ensure notification types include question-related types
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

-- Add updated constraint with question-related notification types
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN ('new_event', 'new_coin', 'post_like', 'post_comment', 'new_post', 'comment_like', 'public_coin', 'new_question', 'answer_added'));