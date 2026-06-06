/*
  # Fix storage RLS policies for wedding-photos bucket
  
  Issue: storage.objects has RLS enabled but no policies, blocking all uploads
  
  Solution: Create permissive policies to allow public read and authenticated write
*/

-- Allow public read access to wedding-photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Public read access to wedding photos'
  ) THEN
    CREATE POLICY "Public read access to wedding photos"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'wedding-photos');
  END IF;
END $$;

-- Allow authenticated users to upload photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Authenticated users can upload photos'
  ) THEN
    CREATE POLICY "Authenticated users can upload photos"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'wedding-photos');
  END IF;
END $$;

-- Allow authenticated users to update their photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Authenticated users can update their photos'
  ) THEN
    CREATE POLICY "Authenticated users can update their photos"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'wedding-photos')
      WITH CHECK (bucket_id = 'wedding-photos');
  END IF;
END $$;

-- Allow authenticated users to delete their photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Authenticated users can delete their photos'
  ) THEN
    CREATE POLICY "Authenticated users can delete their photos"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'wedding-photos');
  END IF;
END $$;
