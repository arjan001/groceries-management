-- Migration: Maintenance Mode & User Active/Inactive Management
-- This migration adds:
--   1. maintenance_mode setting in business_settings for admin panel maintenance
--   2. Ensures users.is_active column exists for toggling user accounts active/inactive
--   3. Adds deactivated_at and deactivated_reason columns to users table

-- ============================================================================
-- 1. Ensure the business_settings table exists (it should already)
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. Insert default maintenance_mode setting (off by default)
-- ============================================================================
INSERT INTO business_settings (key, value, updated_at)
VALUES (
  'maintenance_mode',
  '{"enabled": false, "message": "System under automatic maintenance and backup. Please check back shortly.", "started_at": null, "started_by": null}'::jsonb,
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 3. Ensure users table has is_active column (should already exist)
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- ============================================================================
-- 4. Add deactivated_at timestamp for tracking when user was deactivated
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'deactivated_at'
  ) THEN
    ALTER TABLE users ADD COLUMN deactivated_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- ============================================================================
-- 5. Add deactivated_reason for admin notes on why user was deactivated
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'deactivated_reason'
  ) THEN
    ALTER TABLE users ADD COLUMN deactivated_reason TEXT DEFAULT NULL;
  END IF;
END $$;

-- ============================================================================
-- 6. Add index on is_active for efficient filtering
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);

-- ============================================================================
-- 7. Enable RLS policy to allow authenticated users to read maintenance_mode
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'business_settings' AND policyname = 'allow_read_maintenance_mode'
  ) THEN
    CREATE POLICY allow_read_maintenance_mode ON business_settings
      FOR SELECT USING (true);
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;
