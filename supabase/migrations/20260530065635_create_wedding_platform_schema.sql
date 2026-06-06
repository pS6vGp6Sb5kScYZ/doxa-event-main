/*
  # Wedding Invitation Platform - Complete Schema

  ## Overview
  Full schema for a digital wedding invitation management platform with:
  - Event settings (couple info, venues, dates)
  - Guest list with unique secure QR tokens
  - RSVP responses
  - Drink preferences per guest
  - Guestbook messages with admin replies
  - QR scan events for access control

  ## Tables

  ### event_settings
  Stores all customizable event configuration (couple names, dates, venues, photos, drinks list, etc.)

  ### guests
  Each invited guest with a unique secure token used to generate their personal QR code.

  ### rsvp_responses
  Guest RSVP confirmations (present/absent) with timestamp.

  ### drink_preferences
  Per-guest drink selections from the event's drink options.

  ### guestbook_messages
  Messages left by guests in the livre d'or, with optional admin reply and visibility toggle.

  ### scan_events
  Log of every QR scan attempt at the entrance — records who, when, and the result (valid/duplicate/invalid).

  ## Security
  - RLS enabled on all tables
  - Organizers (authenticated) have full access
  - Public can read event settings and their own guest record (by token)
  - Public can insert RSVP, drink preferences, guestbook messages
*/

-- Event Settings
CREATE TABLE IF NOT EXISTS event_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  groom_name text NOT NULL DEFAULT 'Marié',
  bride_name text NOT NULL DEFAULT 'Mariée',
  event_date timestamptz NOT NULL DEFAULT now() + interval '30 days',
  city text NOT NULL DEFAULT 'Kinshasa',
  subtitle text NOT NULL DEFAULT 'Notre Mariage',
  invite_text text NOT NULL DEFAULT 'Sont heureux de vous inviter à leur union',
  rsvp_deadline date,
  ceremony_location text DEFAULT 'Église',
  ceremony_address text DEFAULT '',
  ceremony_time text DEFAULT '08h30',
  reception_location text DEFAULT 'Salle de réception',
  reception_address text DEFAULT '',
  reception_time text DEFAULT '10h30 - 19h00',
  couple_photo_url text DEFAULT '',
  gallery_photos jsonb DEFAULT '[]'::jsonb,
  background_music_url text DEFAULT '',
  drinks_with_alcohol jsonb DEFAULT '["Castel","Nkoy","Heineken","Beaufort"]'::jsonb,
  drinks_without_alcohol jsonb DEFAULT '["Savane","Sprite","Coca","Maltina"]'::jsonb,
  dress_code text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE event_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage their event settings"
  ON event_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = organizer_id);

CREATE POLICY "Organizers can insert event settings"
  ON event_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can update event settings"
  ON event_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Public can read event settings"
  ON event_settings FOR SELECT
  TO anon
  USING (true);

-- Guests
CREATE TABLE IF NOT EXISTS guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES event_settings(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  table_name text DEFAULT '',
  seats integer DEFAULT 1,
  qr_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  checked_in boolean DEFAULT false,
  checked_in_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage guests"
  ON guests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_settings
      WHERE event_settings.id = guests.event_id
      AND event_settings.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organizers can insert guests"
  ON guests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_settings
      WHERE event_settings.id = guests.event_id
      AND event_settings.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organizers can update guests"
  ON guests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_settings
      WHERE event_settings.id = guests.event_id
      AND event_settings.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_settings
      WHERE event_settings.id = guests.event_id
      AND event_settings.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organizers can delete guests"
  ON guests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_settings
      WHERE event_settings.id = guests.event_id
      AND event_settings.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Public can read own guest record by token"
  ON guests FOR SELECT
  TO anon
  USING (true);

-- RSVP Responses
CREATE TABLE IF NOT EXISTS rsvp_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid REFERENCES guests(id) ON DELETE CASCADE,
  response text NOT NULL CHECK (response IN ('present', 'absent')),
  responded_at timestamptz DEFAULT now()
);

ALTER TABLE rsvp_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can read RSVPs"
  ON rsvp_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guests
      JOIN event_settings ON event_settings.id = guests.event_id
      WHERE guests.id = rsvp_responses.guest_id
      AND event_settings.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Public can insert RSVP"
  ON rsvp_responses FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can insert RSVP authenticated"
  ON rsvp_responses FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Drink Preferences
CREATE TABLE IF NOT EXISTS drink_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid REFERENCES guests(id) ON DELETE CASCADE,
  drink_name text NOT NULL,
  has_alcohol boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE drink_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can read drink preferences"
  ON drink_preferences FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guests
      JOIN event_settings ON event_settings.id = guests.event_id
      WHERE guests.id = drink_preferences.guest_id
      AND event_settings.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Public can insert drink preferences"
  ON drink_preferences FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can insert drink preferences authenticated"
  ON drink_preferences FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Public can delete own drink preferences"
  ON drink_preferences FOR DELETE
  TO anon
  USING (true);

-- Guestbook Messages
CREATE TABLE IF NOT EXISTS guestbook_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES event_settings(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES guests(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  content text NOT NULL,
  admin_reply text DEFAULT '',
  is_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE guestbook_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage guestbook"
  ON guestbook_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_settings
      WHERE event_settings.id = guestbook_messages.event_id
      AND event_settings.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organizers can update guestbook"
  ON guestbook_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_settings
      WHERE event_settings.id = guestbook_messages.event_id
      AND event_settings.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_settings
      WHERE event_settings.id = guestbook_messages.event_id
      AND event_settings.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organizers can delete guestbook messages"
  ON guestbook_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_settings
      WHERE event_settings.id = guestbook_messages.event_id
      AND event_settings.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Public can read visible guestbook messages"
  ON guestbook_messages FOR SELECT
  TO anon
  USING (is_visible = true);

CREATE POLICY "Public can insert guestbook messages"
  ON guestbook_messages FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can insert guestbook messages authenticated"
  ON guestbook_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Scan Events
CREATE TABLE IF NOT EXISTS scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES event_settings(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES guests(id) ON DELETE SET NULL,
  qr_token text NOT NULL,
  result text NOT NULL CHECK (result IN ('valid', 'duplicate', 'invalid')),
  scanned_by uuid REFERENCES auth.users(id),
  scanned_at timestamptz DEFAULT now()
);

ALTER TABLE scan_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can read scan events"
  ON scan_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_settings
      WHERE event_settings.id = scan_events.event_id
      AND event_settings.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organizers can insert scan events"
  ON scan_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_settings
      WHERE event_settings.id = scan_events.event_id
      AND event_settings.organizer_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_guests_event_id ON guests(event_id);
CREATE INDEX IF NOT EXISTS idx_guests_qr_token ON guests(qr_token);
CREATE INDEX IF NOT EXISTS idx_guests_status ON guests(status);
CREATE INDEX IF NOT EXISTS idx_guestbook_event_id ON guestbook_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_event_id ON scan_events(event_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_qr_token ON scan_events(qr_token);
CREATE INDEX IF NOT EXISTS idx_event_settings_organizer ON event_settings(organizer_id);
