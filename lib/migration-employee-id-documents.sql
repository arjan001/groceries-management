-- =============================================
-- EMPLOYEE ID DOCUMENT UPLOAD - STORAGE & SCHEMA
-- Run in Supabase SQL Editor
-- =============================================

-- 1. Add id_document_url column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS id_document_url TEXT;

-- 2. Create storage bucket for employee ID documents (private - not publicly accessible)
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies for employee-documents bucket

-- Allow authenticated users to read employee documents
CREATE POLICY "Auth read employee-documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'employee-documents');

-- Allow authenticated users to upload employee documents
CREATE POLICY "Auth upload employee-documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'employee-documents');

-- Allow authenticated users to update employee documents
CREATE POLICY "Auth update employee-documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'employee-documents');

-- Allow authenticated users to delete employee documents
CREATE POLICY "Auth delete employee-documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'employee-documents');
