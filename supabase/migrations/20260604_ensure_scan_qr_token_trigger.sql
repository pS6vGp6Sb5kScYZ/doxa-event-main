-- Migration: ensure scan_events.qr_token is always populated

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.ensure_scan_qr_token()
RETURNS trigger AS $$
BEGIN
  IF NEW.qr_token IS NULL THEN
    -- try to copy from guest record if available
    IF NEW.guest_id IS NOT NULL THEN
      SELECT qr_token INTO NEW.qr_token FROM guests WHERE id = NEW.guest_id LIMIT 1;
    END IF;

    -- fallback: generate a token
    IF NEW.qr_token IS NULL THEN
      NEW.qr_token := gen_random_uuid()::text;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ensure_scan_qr_token ON scan_events;
CREATE TRIGGER trg_ensure_scan_qr_token
BEFORE INSERT OR UPDATE ON scan_events
FOR EACH ROW
EXECUTE PROCEDURE public.ensure_scan_qr_token();

-- Optional check: find existing problematic rows
-- SELECT id, guest_id, qr_token FROM scan_events WHERE qr_token IS NULL LIMIT 10;

-- Backfill existing NULL qr_token rows by setting them from guest or generating a uuid
UPDATE scan_events se
SET qr_token = COALESCE(g.qr_token, gen_random_uuid()::text)
FROM guests g
WHERE (se.guest_id = g.id OR g.id IS NULL) AND se.qr_token IS NULL;

-- For rows not matched to guests, the WHERE above won't update; run a final pass
UPDATE scan_events SET qr_token = gen_random_uuid()::text WHERE qr_token IS NULL;
