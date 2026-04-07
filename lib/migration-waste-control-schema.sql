-- Migration: Add missing columns to waste_records table
-- The waste_records table was missing columns that the waste-control UI expects:
-- category, approval_status (was 'status'), approval_date, approval_notes

-- Add category column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'waste_records' AND column_name = 'category') THEN
    ALTER TABLE waste_records ADD COLUMN category TEXT DEFAULT 'Raw Materials';
  END IF;
END $$;

-- Rename 'status' to 'approval_status' for consistency with outlet_waste_records
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'waste_records' AND column_name = 'status')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'waste_records' AND column_name = 'approval_status') THEN
    ALTER TABLE waste_records RENAME COLUMN status TO approval_status;
  END IF;
END $$;

-- Add approval_status if neither 'status' nor 'approval_status' existed
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'waste_records' AND column_name = 'approval_status') THEN
    ALTER TABLE waste_records ADD COLUMN approval_status TEXT DEFAULT 'Pending';
  END IF;
END $$;

-- Add approval_date column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'waste_records' AND column_name = 'approval_date') THEN
    ALTER TABLE waste_records ADD COLUMN approval_date DATE;
  END IF;
END $$;

-- Add approval_notes column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'waste_records' AND column_name = 'approval_notes') THEN
    ALTER TABLE waste_records ADD COLUMN approval_notes TEXT;
  END IF;
END $$;

-- Create index on approval_status for performance
CREATE INDEX IF NOT EXISTS idx_waste_records_status ON waste_records(approval_status);
CREATE INDEX IF NOT EXISTS idx_waste_records_category ON waste_records(category);
