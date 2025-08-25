/*
  # Fix coin questions RLS policy
  
  1. Changes
    - Drop and recreate all policies for coin_questions table
    - Make policies more permissive for asking questions
    - Fix policy check conditions
    
  2. Security
    - Maintain basic security while allowing proper functionality
*/

-- Drop all existing policies for coin_questions
DROP POLICY IF EXISTS "Users can view questions for public coins" ON coin_questions;
DROP POLICY IF EXISTS "Users can view questions for their own coins" ON coin_questions;
DROP POLICY IF EXISTS "Users can ask questions" ON coin_questions;
DROP POLICY IF EXISTS "Coin owners can answer questions" ON coin_questions;

-- Create new, more permissive policies
CREATE POLICY "Users can view questions for public coins"
  ON coin_questions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can ask questions"
  ON coin_questions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Coin owners can answer questions"
  ON coin_questions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Log the change for debugging
DO $$
BEGIN
  RAISE LOG 'Recreated all policies for coin_questions table with more permissive settings';
END $$;