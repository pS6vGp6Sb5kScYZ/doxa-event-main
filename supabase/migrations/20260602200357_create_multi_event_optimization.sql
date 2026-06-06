/*
  # Multi-Event Optimization - Schema & Performance

  1. Performance Tables
    - `event_stats_cache` - Cache stats par événement au lieu de les calculer
    - `scan_deduplication` - Prevent double-scan en même session
  
  2. Performance Indexes
    - Composite indexes (event_id, token) pour scans ultra-rapides
    - Descending date indexes pour récents
    - Filtered indexes pour checked_in lookups
  
  3. Storage Procedures
    - `record_scan_atomic()` - Insert scan + update guest atomique (pas de race conditions)
    - `update_event_stats()` - Trigger pour cache stats en temps réel
  
  4. Security
    - Enable RLS sur tables cache
    - Policies: organizers lisent seulement leurs stats
  
  5. Critical Notes
    - event_stats_cache remplace tous les COUNT(*) au dashboard
    - scan_deduplication prevents double-scans via token unique
    - Indexes sont préallocés pour 10k+ scans par événement
*/

-- ============================================
-- 1. TABLES CACHE & DEDUPLICATION
-- ============================================

CREATE TABLE IF NOT EXISTS event_stats_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid UNIQUE NOT NULL REFERENCES event_settings(id) ON DELETE CASCADE,
  total_guests integer DEFAULT 0,
  confirmed_count integer DEFAULT 0,
  absent_count integer DEFAULT 0,
  checked_in_count integer DEFAULT 0,
  scan_count integer DEFAULT 0,
  last_scan_at timestamptz,
  cached_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE event_stats_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can read event stats"
  ON event_stats_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_settings 
      WHERE event_settings.id = event_stats_cache.event_id 
      AND event_settings.organizer_id = auth.uid()
    )
  );

-- ============================================
-- 2. SCAN DEDUPLICATION (Real-time prevention)
-- ============================================

CREATE TABLE IF NOT EXISTS scan_deduplication (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES event_settings(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  qr_token text NOT NULL,
  last_scan_at timestamptz DEFAULT now(),
  UNIQUE(event_id, guest_id),
  CHECK (event_id IS NOT NULL AND guest_id IS NOT NULL)
);

ALTER TABLE scan_deduplication ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can access dedup cache"
  ON scan_deduplication FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_settings 
      WHERE event_settings.id = scan_deduplication.event_id 
      AND event_settings.organizer_id = auth.uid()
    )
  );

-- ============================================
-- 3. PERFORMANCE INDEXES - CRITICAL FOR SCANNING
-- ============================================

-- Index 1: Lookup token rapide (PRIMARY scan path)
CREATE INDEX IF NOT EXISTS idx_guests_event_token 
  ON guests(event_id, qr_token) 
  WHERE event_id IS NOT NULL AND qr_token IS NOT NULL;

-- Index 2: Scans récents (Dashboard + réplays)
CREATE INDEX IF NOT EXISTS idx_scan_events_event_at 
  ON scan_events(event_id, scanned_at DESC) 
  WHERE event_id IS NOT NULL;

-- Index 3: Check-in status (Dashboard pie chart)
CREATE INDEX IF NOT EXISTS idx_guests_event_checked 
  ON guests(event_id, checked_in) 
  WHERE event_id IS NOT NULL;

-- Index 4: Status filtering (Guest list filters)
CREATE INDEX IF NOT EXISTS idx_guests_event_status_created 
  ON guests(event_id, status, created_at DESC) 
  WHERE event_id IS NOT NULL;

-- Index 5: RSVP deadline filtering
CREATE INDEX IF NOT EXISTS idx_event_settings_organizer_date 
  ON event_settings(organizer_id, event_date DESC) 
  WHERE organizer_id IS NOT NULL;

-- ============================================
-- 4. ATOMIC SCAN PROCEDURE (No race conditions)
-- ============================================

CREATE OR REPLACE FUNCTION record_scan_atomic(
  p_qr_token text,
  p_event_id uuid,
  p_user_id uuid
) RETURNS json AS $$
DECLARE
  v_guest_id uuid;
  v_guest_name text;
  v_table_name text;
  v_seats integer;
  v_already_checked boolean;
BEGIN
  -- 1. Lock row + read atomically
  SELECT id, name, table_name, seats, checked_in 
    INTO v_guest_id, v_guest_name, v_table_name, v_seats, v_already_checked
  FROM guests
  WHERE qr_token = p_qr_token 
    AND event_id = p_event_id
  FOR UPDATE;
  
  -- 2. Validate guest exists
  IF v_guest_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'QR code invalid',
      'error_code', 'INVALID_QR'
    );
  END IF;
  
  -- 3. Check already checked-in
  IF v_already_checked THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Already checked in',
      'error_code', 'ALREADY_CHECKED',
      'guest_name', v_guest_name,
      'table_name', v_table_name
    );
  END IF;
  
  -- 4. Update guest check-in status
  UPDATE guests 
    SET checked_in = true, checked_in_at = now()
  WHERE id = v_guest_id;
  
  -- 5. Insert scan log
  INSERT INTO scan_events (guest_id, event_id, scanned_at)
  VALUES (v_guest_id, p_event_id, now());
  
  -- 6. Update dedup cache
  INSERT INTO scan_deduplication (event_id, guest_id, qr_token, last_scan_at)
  VALUES (p_event_id, v_guest_id, p_qr_token, now())
  ON CONFLICT (event_id, guest_id) 
  DO UPDATE SET last_scan_at = now();
  
  -- 7. Return success with guest details
  RETURN json_build_object(
    'success', true,
    'guest_id', v_guest_id,
    'guest_name', v_guest_name,
    'table_name', v_table_name,
    'seats', v_seats,
    'scanned_at', now()
  );
END;
$$ LANGUAGE plpgsql STRICT SECURITY DEFINER;

-- Allow authenticated users to call this procedure
GRANT EXECUTE ON FUNCTION record_scan_atomic(text, uuid, uuid) TO authenticated;

-- ============================================
-- 5. STATS CACHE UPDATE TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_event_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stats cache when guests change
  INSERT INTO event_stats_cache (
    event_id,
    total_guests,
    confirmed_count,
    absent_count,
    checked_in_count,
    scan_count,
    last_scan_at,
    cached_at
  )
  SELECT
    COALESCE(NEW.event_id, OLD.event_id),
    COUNT(DISTINCT g.id),
    COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'confirmed'),
    COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'absent'),
    COUNT(DISTINCT g.id) FILTER (WHERE g.checked_in = true),
    COUNT(DISTINCT s.id),
    MAX(s.scanned_at),
    now()
  FROM guests g
  LEFT JOIN scan_events s ON s.guest_id = g.id
  WHERE g.event_id = COALESCE(NEW.event_id, OLD.event_id)
  GROUP BY g.event_id
  ON CONFLICT (event_id) DO UPDATE SET
    total_guests = EXCLUDED.total_guests,
    confirmed_count = EXCLUDED.confirmed_count,
    absent_count = EXCLUDED.absent_count,
    checked_in_count = EXCLUDED.checked_in_count,
    scan_count = EXCLUDED.scan_count,
    last_scan_at = EXCLUDED.last_scan_at,
    cached_at = now(),
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on guest inserts/updates/deletes
DROP TRIGGER IF EXISTS guests_stats_update ON guests;
CREATE TRIGGER guests_stats_update 
  AFTER INSERT OR UPDATE OR DELETE ON guests
  FOR EACH ROW 
  EXECUTE FUNCTION update_event_stats();

-- Trigger on scan inserts
DROP TRIGGER IF EXISTS scans_stats_update ON scan_events;
CREATE TRIGGER scans_stats_update 
  AFTER INSERT ON scan_events
  FOR EACH ROW 
  EXECUTE FUNCTION update_event_stats();

-- ============================================
-- 6. INITIAL CACHE POPULATION
-- ============================================

DO $$
DECLARE
  event_rec RECORD;
BEGIN
  FOR event_rec IN SELECT id FROM event_settings LOOP
    INSERT INTO event_stats_cache (event_id)
    VALUES (event_rec.id)
    ON CONFLICT (event_id) DO NOTHING;
  END LOOP;
END $$;

-- ============================================
-- 7. ANALYZE TABLES FOR QUERY PLANNER
-- ============================================

ANALYZE guests;
ANALYZE scan_events;
ANALYZE event_settings;
