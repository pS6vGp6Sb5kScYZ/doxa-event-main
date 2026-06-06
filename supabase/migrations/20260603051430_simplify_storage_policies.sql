/*
  # Simplify storage RLS policies - allow all authenticated uploads
  
  The previous policies were too restrictive. We need simpler policies:
  - Public can read from wedding-photos bucket
  - Any authenticated user can upload/update/delete in wedding-photos
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Public read access to wedding photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their photos" ON storage.objects;

-- Create simpler policies
CREATE POLICY "Public read wedding-photos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'wedding-photos');

CREATE POLICY "Authenticated upload to wedding-photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'wedding-photos');

CREATE POLICY "Authenticated update wedding-photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'wedding-photos')
  WITH CHECK (bucket_id = 'wedding-photos');

CREATE POLICY "Authenticated delete wedding-photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'wedding-photos');
