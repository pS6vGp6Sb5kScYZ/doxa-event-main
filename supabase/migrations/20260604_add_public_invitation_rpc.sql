-- Migration: add public RPC for invitation access by qr_token

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_qr_token text)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'guest', jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'email', g.email,
      'phone', g.phone,
      'table_name', g.table_name,
      'seats', g.seats,
      'status', g.status,
      'checked_in', g.checked_in,
      'checked_in_at', g.checked_in_at,
      'created_at', g.created_at,
      'updated_at', g.updated_at
    ),
    'event', jsonb_build_object(
      'id', es.id,
      'organizer_id', es.organizer_id,
      'groom_name', es.groom_name,
      'bride_name', es.bride_name,
      'event_date', es.event_date,
      'city', es.city,
      'subtitle', es.subtitle,
      'invite_text', es.invite_text,
      'ceremony_location', es.ceremony_location,
      'ceremony_address', es.ceremony_address,
      'ceremony_time', es.ceremony_time,
      'reception_location', es.reception_location,
      'reception_address', es.reception_address,
      'reception_time', es.reception_time,
      'couple_photo_url', es.couple_photo_url,
      'gallery_photos', es.gallery_photos,
      'background_music_url', es.background_music_url,
      'drinks_with_alcohol', es.drinks_with_alcohol,
      'drinks_without_alcohol', es.drinks_without_alcohol,
      'dress_code', es.dress_code,
      'created_at', es.created_at,
      'updated_at', es.updated_at
    ),
    'drinks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('drink_name', drink_name, 'has_alcohol', has_alcohol))
      FROM drink_preferences
      WHERE guest_id = g.id
    ), '[]'::jsonb),
    'messages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'event_id', event_id,
        'guest_id', guest_id,
        'author_name', author_name,
        'content', content,
        'admin_reply', admin_reply,
        'is_visible', is_visible,
        'created_at', created_at
      ) ORDER BY created_at DESC)
      FROM guestbook_messages
      WHERE event_id = es.id
        AND is_visible = true
    ), '[]'::jsonb)
  )
  INTO result
  FROM guests g
  JOIN event_settings es ON es.id = g.event_id
  WHERE g.qr_token = p_qr_token
  LIMIT 1;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon;
