-- Migration: add invite_snapshot to guests and trigger to populate it
-- Adds a JSON snapshot of the event on guest insert/update and generates a qr_token if missing

-- ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- add invite_snapshot column to guests
ALTER TABLE IF EXISTS guests
  ADD COLUMN IF NOT EXISTS invite_snapshot jsonb DEFAULT '{}'::jsonb;

-- create trigger function to populate invite_snapshot and generate qr_token
CREATE OR REPLACE FUNCTION public.fill_guest_invite_snapshot()
RETURNS trigger AS $$
BEGIN
  -- generate a token if one wasn't provided
  IF NEW.qr_token IS NULL THEN
    NEW.qr_token := gen_random_uuid();
  END IF;

  -- populate invite_snapshot with selected event fields
  SELECT jsonb_build_object(
    'groom_name', es.groom_name,
    'bride_name', es.bride_name,
    'event_date', es.event_date,
    'city', es.city,
    'invite_text', es.invite_text,
    'ceremony_time', es.ceremony_time,
    'ceremony_location', es.ceremony_location,
    'reception_time', es.reception_time,
    'reception_location', es.reception_location,
    'couple_photo_url', es.couple_photo_url
  )
  INTO NEW.invite_snapshot
  FROM event_settings es
  WHERE es.id = NEW.event_id
  LIMIT 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- create trigger to run before insert or update
DROP TRIGGER IF EXISTS trg_fill_guest_invite_snapshot ON guests;
CREATE TRIGGER trg_fill_guest_invite_snapshot
BEFORE INSERT OR UPDATE ON guests
FOR EACH ROW
EXECUTE PROCEDURE public.fill_guest_invite_snapshot();

-- optional: backfill existing guests (will run trigger on insert/update, so use update to refresh)
UPDATE guests SET invite_snapshot = (SELECT jsonb_build_object(
    'groom_name', es.groom_name,
    'bride_name', es.bride_name,
    'event_date', es.event_date,
    'city', es.city,
    'invite_text', es.invite_text,
    'ceremony_time', es.ceremony_time,
    'ceremony_location', es.ceremony_location,
    'reception_time', es.reception_time,
    'reception_location', es.reception_location,
    'couple_photo_url', es.couple_photo_url
  ) FROM event_settings es WHERE es.id = guests.event_id LIMIT 1)
WHERE invite_snapshot IS NULL OR invite_snapshot = '{}'::jsonb;
