ALTER TABLE event_settings
  ADD COLUMN IF NOT EXISTS ceremony_map_embed text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reception_map_embed text DEFAULT NULL;

COMMENT ON COLUMN event_settings.ceremony_map_embed IS 'HTML iframe embed code for ceremony Google Maps';
COMMENT ON COLUMN event_settings.reception_map_embed IS 'HTML iframe embed code for reception Google Maps';
