-- =============================================
-- MIGRATION: Outlet GPS & Rider Auto-Assignment
-- Run this in your Supabase SQL Editor
-- Adds GPS coordinates to outlets table and
-- ensures rider location tracking fields exist
-- =============================================

-- =============================================
-- 1. ADD GPS COORDINATES TO OUTLETS TABLE
-- Enables location-based rider assignment
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outlets' AND column_name = 'gps_lat') THEN
    ALTER TABLE outlets ADD COLUMN gps_lat DECIMAL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outlets' AND column_name = 'gps_lng') THEN
    ALTER TABLE outlets ADD COLUMN gps_lng DECIMAL DEFAULT 0;
  END IF;
END $$;

-- =============================================
-- 2. ENSURE RIDER LOCATION TRACKING FIELDS ON DELIVERIES
-- These columns store the rider's last known GPS position
-- Used for proximity-based auto-assignment
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'rider_lat') THEN
    ALTER TABLE deliveries ADD COLUMN rider_lat DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'rider_lng') THEN
    ALTER TABLE deliveries ADD COLUMN rider_lng DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'rider_heading') THEN
    ALTER TABLE deliveries ADD COLUMN rider_heading DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'rider_speed') THEN
    ALTER TABLE deliveries ADD COLUMN rider_speed DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'rider_location_updated_at') THEN
    ALTER TABLE deliveries ADD COLUMN rider_location_updated_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'auto_delivered') THEN
    ALTER TABLE deliveries ADD COLUMN auto_delivered BOOLEAN DEFAULT false;
  END IF;
END $$;

-- =============================================
-- 3. ADD INDEX FOR RIDER LOCATION LOOKUPS
-- Improves performance of auto-assignment queries
-- =============================================
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_id ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_rider_location ON deliveries(driver_id, rider_location_updated_at DESC);
