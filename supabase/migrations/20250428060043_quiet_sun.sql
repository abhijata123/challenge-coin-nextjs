/*
  # Update events table RLS policies
  
  1. Changes
    - Drop all existing policies
    - Recreate policies with proper admin checks
    - Use email for user identification
    
  2. Security
    - Only admins can create/update/delete events
    - All authenticated users can view events
*/

-- First drop all existing policies
DROP POLICY IF EXISTS "Only admins can create events" ON events;
DROP POLICY IF EXISTS "Only admins can update events" ON events;
DROP POLICY IF EXISTS "Only admins can delete events" ON events;
DROP POLICY IF EXISTS "Users can view all events" ON events;

-- Recreate all policies
CREATE POLICY "Users can view all events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User Dps"
      WHERE email = (auth.jwt() ->> 'email')::text
      AND is_admin = true
    )
  );

CREATE POLICY "Only admins can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "User Dps"
      WHERE email = (auth.jwt() ->> 'email')::text
      AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User Dps"
      WHERE email = (auth.jwt() ->> 'email')::text
      AND is_admin = true
    )
  );

CREATE POLICY "Only admins can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "User Dps"
      WHERE email = (auth.jwt() ->> 'email')::text
      AND is_admin = true
    )
  );