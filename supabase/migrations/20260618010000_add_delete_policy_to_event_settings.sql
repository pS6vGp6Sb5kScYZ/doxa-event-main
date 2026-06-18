ALTER TABLE event_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can delete event settings"
  ON event_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = organizer_id);
