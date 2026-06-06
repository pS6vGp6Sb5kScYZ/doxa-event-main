-- Enhancement: Return last_scan_at timestamp for duplicate scans

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
  v_last_scan_at timestamptz;
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
    INSERT INTO scan_events (event_id, qr_token, result, scanned_by, scanned_at)
    VALUES (p_event_id, p_qr_token, 'invalid', p_user_id, now());

    RETURN json_build_object(
      'success', false,
      'error', 'QR code invalid',
      'error_code', 'INVALID_QR'
    );
  END IF;
  
  -- 3. Check already checked-in
  IF v_already_checked THEN
    -- Get last scan timestamp
    SELECT MAX(scanned_at) INTO v_last_scan_at
    FROM scan_events
    WHERE guest_id = v_guest_id AND event_id = p_event_id AND result = 'valid';

    INSERT INTO scan_events (guest_id, event_id, qr_token, result, scanned_by, scanned_at)
    VALUES (v_guest_id, p_event_id, p_qr_token, 'duplicate', p_user_id, now());

    RETURN json_build_object(
      'success', false,
      'error', 'Already checked in',
      'error_code', 'ALREADY_CHECKED',
      'guest_name', v_guest_name,
      'table_name', v_table_name,
      'last_scan_at', v_last_scan_at
    );
  END IF;
  
  -- 4. Update guest check-in status
  UPDATE guests 
    SET checked_in = true, checked_in_at = now()
  WHERE id = v_guest_id;
  
  -- 5. Insert scan log (include qr_token and result)
  INSERT INTO scan_events (guest_id, event_id, qr_token, result, scanned_by, scanned_at)
  VALUES (v_guest_id, p_event_id, p_qr_token, 'valid', p_user_id, now());
  
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

GRANT EXECUTE ON FUNCTION record_scan_atomic(text, uuid, uuid) TO authenticated;
