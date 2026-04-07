-- =============================================
-- AUTO DELIVERY ASSIGNMENT + OUTLET LOCATION MIGRATION
-- Run this in your Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. ADD ASSIGNMENT MODE TO DELIVERY SETTINGS
-- Supports 'manual' or 'automatic' delivery assignment
-- =============================================
DO $$ BEGIN
  -- Add delivery_assignment_mode to business_settings if not already set
  INSERT INTO business_settings (key, value)
  VALUES (
    'delivery_assignment_mode',
    '"automatic"'
  )
  ON CONFLICT (key) DO NOTHING;
END $$;

-- =============================================
-- 2. ADD GPS LOCATION COLUMNS TO OUTLETS TABLE
-- Allow outlets to store latitude/longitude for map pinning
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outlets' AND column_name = 'gps_lat') THEN
    ALTER TABLE outlets ADD COLUMN gps_lat DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outlets' AND column_name = 'gps_lng') THEN
    ALTER TABLE outlets ADD COLUMN gps_lng DECIMAL;
  END IF;
END $$;

-- =============================================
-- 3. ADD ASSIGNMENT TRACKING COLUMNS TO DELIVERIES
-- Track how a delivery was assigned (manual vs automatic)
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'assignment_mode') THEN
    ALTER TABLE deliveries ADD COLUMN assignment_mode TEXT DEFAULT 'manual'; -- 'manual' or 'automatic'
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'assigned_at') THEN
    ALTER TABLE deliveries ADD COLUMN assigned_at TIMESTAMPTZ;
  END IF;
END $$;
