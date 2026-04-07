-- ============================================================
-- Backups Table Migration
-- Run this SQL in your Supabase SQL Editor to create the
-- backups table needed for the backup system.
-- ============================================================

CREATE TABLE IF NOT EXISTS backups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  backup_id TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  backup_data TEXT NOT NULL,
  size_bytes BIGINT DEFAULT 0,
  table_count INTEGER DEFAULT 0,
  total_rows INTEGER DEFAULT 0,
  trigger TEXT DEFAULT 'manual' CHECK (trigger IN ('manual', 'scheduled')),
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
  errors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by backup_id and date ordering
CREATE INDEX IF NOT EXISTS idx_backups_backup_id ON backups(backup_id);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access backups (API routes use service role key)
CREATE POLICY "Service role full access on backups"
  ON backups
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Comment
COMMENT ON TABLE backups IS 'Stores full database backup snapshots as JSON. Created by the backup system via API routes and scheduled functions.';
