/*
  # Fix event_stats_cache RLS policy
  
  1. Issue
    - Trigger update_event_stats() tries to INSERT/UPDATE event_stats_cache
    - Current RLS policy only allows SELECT, blocks INSERT/UPDATE
    - Result: "new row violates row-level security policy" error when adding guests
  
  2. Solution
    - Add INSERT and UPDATE policies that allow authenticated users to manage stats for their events
    - Keep SELECT policy for reading own event stats
    - Policies check event ownership through event_settings table
*/

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Organizers can read event stats" ON event_stats_cache;

-- Add policy for SELECT - organizers can read their event stats
CREATE POLICY "Organizers can read event stats"
  ON event_stats_cache
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_settings
      WHERE event_settings.id = event_stats_cache.event_id
      AND event_settings.organizer_id = auth.uid()
    )
  );

-- Add policy for INSERT - allow during trigger execution for event organizers
CREATE POLICY "Allow stats updates for event organizers"
  ON event_stats_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_settings
      WHERE event_settings.id = event_stats_cache.event_id
      AND event_settings.organizer_id = auth.uid()
    )
  );

-- Add policy for UPDATE - allow stats updates during trigger execution
CREATE POLICY "Allow stats updates for organizers"
  ON event_stats_cache
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_settings
      WHERE event_settings.id = event_stats_cache.event_id
      AND event_settings.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_settings
      WHERE event_settings.id = event_stats_cache.event_id
      AND event_settings.organizer_id = auth.uid()
    )
  );
