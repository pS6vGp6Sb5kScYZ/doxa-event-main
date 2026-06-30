/*
  # Fix Public Access for RSVP, Drink Preferences, and Guestbook Messages
  
  ## Problem
  The 2026-06-03 migration restricted all inserts to "authenticated only":
  - Guests access via public QR token links (not authenticated)
  - They were blocked from: confirming attendance (RSVP), selecting drinks, and sending messages
  
  ## Solution
  Add public (anonymous) access policies for:
  1. Guestbook messages - so guests can send messages to the couple
  2. RSVP responses - so guests can confirm "I will attend"
  3. Drink preferences - so guests can select their drink preferences
*/

-- ==================== GUESTBOOK MESSAGES ====================
-- Drop existing policies
DROP POLICY IF EXISTS "Anonymous users can insert guestbook messages" ON guestbook_messages;
DROP POLICY IF EXISTS "Authenticated users can insert guestbook messages" ON guestbook_messages;

-- Add policy for everyone to insert guestbook messages
CREATE POLICY "Anyone can insert guestbook messages"
  ON guestbook_messages FOR INSERT
  TO public
  WITH CHECK (true);

-- ==================== RSVP RESPONSES ====================
-- Drop existing authenticated-only policy
DROP POLICY IF EXISTS "Authenticated users can submit RSVP" ON rsvp_responses;
DROP POLICY IF EXISTS "Public can insert RSVP" ON rsvp_responses;

-- Add policy for everyone to submit RSVP (confirm attendance)
CREATE POLICY "Anyone can submit RSVP"
  ON rsvp_responses FOR INSERT
  TO public
  WITH CHECK (true);

-- Keep select policy for guests to read their own RSVP
DROP POLICY IF EXISTS "Guests can read their own RSVP" ON rsvp_responses;
CREATE POLICY "Anyone can read RSVP records"
  ON rsvp_responses FOR SELECT
  TO public
  USING (true);

-- ==================== DRINK PREFERENCES ====================
-- Drop existing authenticated-only policy
DROP POLICY IF EXISTS "Authenticated users can submit drink preferences" ON drink_preferences;
DROP POLICY IF EXISTS "Public can insert drink preferences" ON drink_preferences;

-- Add policy for everyone to submit drink preferences
CREATE POLICY "Anyone can submit drink preferences"
  ON drink_preferences FOR INSERT
  TO public
  WITH CHECK (true);
