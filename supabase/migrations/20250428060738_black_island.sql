-- Drop existing policies
DROP POLICY IF EXISTS "Users can register for events" ON event_attendees;
DROP POLICY IF EXISTS "Users can unregister from events" ON event_attendees;
DROP POLICY IF EXISTS "Users can view event attendees" ON event_attendees;

-- Recreate policies with proper auth checks
CREATE POLICY "Users can view event attendees"
  ON event_attendees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can register for events"
  ON event_attendees FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email')::text = user_id);

CREATE POLICY "Users can unregister from events"
  ON event_attendees FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'email')::text = user_id);