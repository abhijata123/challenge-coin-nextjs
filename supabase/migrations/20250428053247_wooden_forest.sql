/*
  # Add events functionality
  
  1. New Tables
    - events: Store event information
    - event_attendees: Track event attendance
    
  2. Security
    - RLS enabled for both tables
    - Policies for read/write access
*/

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  date date NOT NULL,
  time text NOT NULL,
  location text NOT NULL,
  type text NOT NULL CHECK (type IN ('online', 'in-person')),
  max_attendees integer NOT NULL CHECK (max_attendees > 0),
  current_attendees integer DEFAULT 0,
  host_id text NOT NULL REFERENCES "User Dps"(email) ON DELETE CASCADE,
  requires_coin boolean DEFAULT false,
  coin_type text,
  created_at timestamptz DEFAULT now()
);

-- Create event_attendees table
CREATE TABLE IF NOT EXISTS event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  user_id text REFERENCES "User Dps"(email) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

-- Policies for events table
CREATE POLICY "Users can view all events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = host_id);

CREATE POLICY "Users can update own events"
  ON events FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = host_id)
  WITH CHECK (auth.uid()::text = host_id);

CREATE POLICY "Users can delete own events"
  ON events FOR DELETE
  TO authenticated
  USING (auth.uid()::text = host_id);

-- Policies for event_attendees table
CREATE POLICY "Users can view event attendees"
  ON event_attendees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can register for events"
  ON event_attendees FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can unregister from events"
  ON event_attendees FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- Function to update attendee count
CREATE OR REPLACE FUNCTION update_event_attendees()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events
    SET current_attendees = current_attendees + 1
    WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events
    SET current_attendees = current_attendees - 1
    WHERE id = OLD.event_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger for attendee count
CREATE TRIGGER update_event_attendees_trigger
AFTER INSERT OR DELETE ON event_attendees
FOR EACH ROW
EXECUTE FUNCTION update_event_attendees();