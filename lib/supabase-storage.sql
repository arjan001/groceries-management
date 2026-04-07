-- =============================================
-- SNACKOH BAKERS - SUPABASE STORAGE BUCKETS
-- Run in Supabase SQL Editor
-- =============================================

-- Create storage buckets for images
INSERT INTO storage.buckets (id, name, public) VALUES
  ('logos', 'logos', true),
  ('products', 'products', true),
  ('employees', 'employees', true),
  ('receipts', 'receipts', false),
  ('assets', 'assets', true),
  ('offers', 'offers', true),
  ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to public buckets
CREATE POLICY "Public read logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Public read products" ON storage.objects FOR SELECT USING (bucket_id = 'products');
CREATE POLICY "Public read employees" ON storage.objects FOR SELECT USING (bucket_id = 'employees');
CREATE POLICY "Public read assets" ON storage.objects FOR SELECT USING (bucket_id = 'assets');
CREATE POLICY "Public read offers" ON storage.objects FOR SELECT USING (bucket_id = 'offers');

-- Allow authenticated uploads to all buckets
CREATE POLICY "Auth upload logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos');
CREATE POLICY "Auth upload products" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'products');
CREATE POLICY "Auth upload employees" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'employees');
CREATE POLICY "Auth upload receipts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "Auth upload assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'assets');
CREATE POLICY "Auth upload offers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'offers');
CREATE POLICY "Auth upload documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents');

-- Allow authenticated delete
CREATE POLICY "Auth delete all" ON storage.objects FOR DELETE USING (true);
CREATE POLICY "Auth update all" ON storage.objects FOR UPDATE USING (true);
