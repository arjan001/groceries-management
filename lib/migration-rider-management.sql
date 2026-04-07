-- =============================================
-- RIDER MANAGEMENT MODULE - MIGRATION
-- Run this in your Supabase SQL Editor
-- Adds rider damage reporting, delivery fee tracking,
-- and updates waste records for rider attribution
-- =============================================

-- =============================================
-- 1. RIDER DAMAGE REPORTS TABLE
-- Riders/drivers report damage during deliveries
-- All reports require admin approval
-- =============================================
CREATE TABLE IF NOT EXISTS rider_damage_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  report_number TEXT UNIQUE,
  reported_by TEXT NOT NULL,
  reported_by_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  tracking_number TEXT,
  damage_type TEXT NOT NULL DEFAULT 'Product Damage',
    -- 'Product Damage', 'Packaging Damage', 'Vehicle Damage',
    -- 'Equipment Damage', 'Customer Property', 'Other'
  description TEXT NOT NULL,
  items_affected TEXT,
  estimated_cost DECIMAL DEFAULT 0,
  photos TEXT,              -- comma-separated URLs or JSON array
  status TEXT DEFAULT 'Pending',  -- 'Pending', 'Approved', 'Rejected'
  approved_by TEXT,
  approved_by_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rider_damage_status ON rider_damage_reports(status);
CREATE INDEX IF NOT EXISTS idx_rider_damage_reported_by ON rider_damage_reports(reported_by);
CREATE INDEX IF NOT EXISTS idx_rider_damage_delivery ON rider_damage_reports(delivery_id);
CREATE INDEX IF NOT EXISTS idx_rider_damage_date ON rider_damage_reports(created_at);

-- =============================================
-- 2. ADD reported_by TO WASTE RECORDS
-- Track which rider/employee reported the waste
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'waste_records' AND column_name = 'reported_by') THEN
    ALTER TABLE waste_records ADD COLUMN reported_by TEXT;
  END IF;
END $$;

-- =============================================
-- 3. ADD DELIVERY FEE COLUMNS
-- Track delivery fees attached to each delivery
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'delivery_fee') THEN
    ALTER TABLE deliveries ADD COLUMN delivery_fee DECIMAL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'customer_name') THEN
    ALTER TABLE deliveries ADD COLUMN customer_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'customer_phone') THEN
    ALTER TABLE deliveries ADD COLUMN customer_phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'customer_location') THEN
    ALTER TABLE deliveries ADD COLUMN customer_location TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'customer_address') THEN
    ALTER TABLE deliveries ADD COLUMN customer_address TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'customer_id') THEN
    ALTER TABLE deliveries ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'customer_gps_lat') THEN
    ALTER TABLE deliveries ADD COLUMN customer_gps_lat DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'customer_gps_lng') THEN
    ALTER TABLE deliveries ADD COLUMN customer_gps_lng DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'driver_name') THEN
    ALTER TABLE deliveries ADD COLUMN driver_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'vehicle_id') THEN
    ALTER TABLE deliveries ADD COLUMN vehicle_id UUID REFERENCES assets(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'vehicle_name') THEN
    ALTER TABLE deliveries ADD COLUMN vehicle_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'time_slot') THEN
    ALTER TABLE deliveries ADD COLUMN time_slot TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'items') THEN
    ALTER TABLE deliveries ADD COLUMN items JSONB DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'special_instructions') THEN
    ALTER TABLE deliveries ADD COLUMN special_instructions TEXT;
  END IF;
END $$;

-- =============================================
-- 4. ADD RIDER-SPECIFIC EMPLOYEE FIELDS
-- Track login roles for system access control
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'login_role') THEN
    ALTER TABLE employees ADD COLUMN login_role TEXT DEFAULT 'Viewer';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'login_email') THEN
    ALTER TABLE employees ADD COLUMN login_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'system_access') THEN
    ALTER TABLE employees ADD COLUMN system_access BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'permissions') THEN
    ALTER TABLE employees ADD COLUMN permissions JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- =============================================
-- 5. SEED: Add Rider-specific role and permissions
-- =============================================
INSERT INTO roles (name, description) VALUES
  ('Rider', 'Delivery rider with limited access to deliveries and reporting')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, category) VALUES
  ('Manage Customers', 'Create and manage customer records', 'Customers'),
  ('Manage Pricing', 'Manage product pricing tiers', 'Pricing'),
  ('Manage Purchases', 'Create and manage purchase orders', 'Procurement'),
  ('View Waste Reports', 'View waste and damage reports', 'Reports'),
  ('Submit Waste Reports', 'Submit waste reports for admin approval', 'Reports'),
  ('Submit Damage Reports', 'Submit damage reports for admin approval', 'Reports')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 6. GRANT DEFAULT PERMISSIONS TO RIDER ROLE
-- =============================================
DO $$
DECLARE
  rider_role_id UUID;
  perm_record RECORD;
BEGIN
  SELECT id INTO rider_role_id FROM roles WHERE name = 'Rider' LIMIT 1;
  IF rider_role_id IS NOT NULL THEN
    FOR perm_record IN
      SELECT id FROM permissions WHERE name IN (
        'View Dashboard',
        'Manage Deliveries',
        'View Deliveries',
        'Submit Waste Reports',
        'Submit Damage Reports',
        'View Waste Reports'
      )
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (rider_role_id, perm_record.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Grant default permissions to Driver role
DO $$
DECLARE
  driver_role_id UUID;
  perm_record RECORD;
BEGIN
  SELECT id INTO driver_role_id FROM roles WHERE name = 'Driver' LIMIT 1;
  IF driver_role_id IS NOT NULL THEN
    FOR perm_record IN
      SELECT id FROM permissions WHERE name IN (
        'View Dashboard',
        'Manage Deliveries',
        'View Deliveries',
        'Manage Orders',
        'View Orders',
        'Submit Waste Reports',
        'Submit Damage Reports',
        'View Waste Reports'
      )
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (driver_role_id, perm_record.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;
