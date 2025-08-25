/*
  # Fix events RLS policies for admin-only access
  
  1. Changes
    - Update event creation policy to only allow admins
    - Keep other policies unchanged
    
  2. Security
    - Maintain existing security model for viewing events
*/

-- Drop existing insert policy
DROP POLICY IF EXISTS "Users can create events" ON events;

-- Create new admin-only insert policy
CREATE POLICY "Only admins can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User Dps"
      WHERE email = auth.uid()::text
      AND is_admin = true
    )
  );

-- Update update policy to admin-only
DROP POLICY IF EXISTS "Users can update own events" ON events;
CREATE POLICY "Only admins can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "User Dps"
      WHERE email = auth.uid()::text
      AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User Dps"
      WHERE email = auth.uid()::text
      AND is_admin = true
    )
  );

-- Update delete policy to admin-only
DROP POLICY IF EXISTS "Users can delete own events" ON events;
CREATE POLICY "Only admins can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "User Dps"
      WHERE email = auth.uid()::text
      AND is_admin = true
    )
  );