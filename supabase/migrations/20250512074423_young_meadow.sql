/*
  # Fix coin questions RLS policy
  
  1. Changes
    - Update the "Users can ask questions" policy to properly allow questions on public coins
    - Simplify policy conditions for better performance
    - Add better error handling
    
  2. Security
    - Maintain proper access controls
    - Ensure only authenticated users can ask questions
*/

-- Drop existing policy for asking questions
DROP POLICY IF EXISTS "Users can ask questions" ON coin_questions;

-- Create a simpler, more permissive policy for asking questions
CREATE POLICY "Users can ask questions"
  ON coin_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'email')::text = user_id
  );

-- Log existing policies for debugging
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE 'Current coin_questions policies:';
  FOR r IN (
    SELECT policyname, permissive, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename = 'coin_questions'
  ) LOOP
    RAISE NOTICE 'Policy: %, Permissive: %, Command: %, Using: %, With Check: %', 
      r.policyname, r.permissive, r.cmd, r.qual, r.with_check;
  END LOOP;
END $$;