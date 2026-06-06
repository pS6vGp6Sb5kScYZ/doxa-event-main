-- Create test event and guest data
-- Execute this directly in Supabase SQL Editor

-- Insert test event
INSERT INTO event_settings (
  organizer_id,
  groom_name,
  bride_name,
  event_date,
  city,
  subtitle,
  invite_text,
  ceremony_time,
  ceremony_location,
  ceremony_address,
  reception_time,
  reception_location,
  reception_address,
  drinks_with_alcohol,
  drinks_without_alcohol,
  dress_code,
  gallery_photos,
  background_music_url,
  couple_photo_url
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Justice',
  'Grace',
  '2026-12-25T18:00:00Z',
  'Kinshasa',
  'Sont heureux de vous inviter à leur union',
  'Sont heureux de vous inviter à partager ce moment magique',
  '18h00',
  'Église de Kinshasa',
  'Avenue de la République, Kinshasa',
  '19h00',
  'Salle de réception',
  'Rue de la Paix, Kinshasa',
  ARRAY['Vin rouge', 'Bière', 'Champagne'],
  ARRAY['Jus', 'Eau', 'Soda'],
  'Élégant',
  ARRAY[]::text[],
  '',
  ''
) ON CONFLICT DO NOTHING;

-- Get the event ID
DO $$
DECLARE
  event_id UUID;
  guest_token UUID;
BEGIN
  -- Get the test event
  SELECT id INTO event_id FROM event_settings 
  WHERE groom_name = 'Justice' AND bride_name = 'Grace' 
  LIMIT 1;
  
  IF event_id IS NOT NULL THEN
    -- Generate token
    guest_token := gen_random_uuid();
    
    -- Insert test guest
    INSERT INTO guests (
      event_id,
      name,
      email,
      phone,
      qr_token,
      table_name,
      seats,
      status
    ) VALUES (
      event_id,
      'Couple David Songa',
      'test@invitation.com',
      '+243123456789',
      guest_token,
      'Table 1',
      2,
      'pending'
    ) ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Test guest created with token: %', guest_token;
    RAISE NOTICE 'Test URL: http://localhost:5173/invite/%', guest_token;
  ELSE
    RAISE NOTICE 'Event not created - please create it first';
  END IF;
END$$;
