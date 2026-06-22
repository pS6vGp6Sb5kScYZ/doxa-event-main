ALTER TABLE event_settings
  RENAME COLUMN ceremony_map_embed TO ceremony_map_url;

ALTER TABLE event_settings
  RENAME COLUMN reception_map_embed TO reception_map_url;

COMMENT ON COLUMN event_settings.ceremony_map_url IS 'URL de partage Google Maps pour la cérémonie';
COMMENT ON COLUMN event_settings.reception_map_url IS 'URL de partage Google Maps pour la réception';
