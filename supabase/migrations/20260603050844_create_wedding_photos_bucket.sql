/*
  # Create wedding-photos storage bucket
  
  Creates the storage bucket needed for couple photos and gallery images.
  Bucket is public so photos can be displayed on invitations.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('wedding-photos', 'wedding-photos', true)
ON CONFLICT (id) DO NOTHING;
