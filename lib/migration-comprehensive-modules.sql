-- =============================================
-- COMPREHENSIVE MODULE MIGRATION
-- Stock Take, Shifts, Insurance, Government Integration, Delivery Tracking
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. STOCK TAKE & STOCK COUNT
-- =============================================
CREATE TABLE IF NOT EXISTS stock_takes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reference_number TEXT NOT NULL UNIQUE,
  outlet_id UUID,
  outlet_name TEXT,
  conducted_by TEXT NOT NULL,
  conducted_by_id UUID,
  status TEXT DEFAULT 'In Progress', -- In Progress, Completed, Approved
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  notes TEXT,
  total_items_counted INTEGER DEFAULT 0,
  total_discrepancies INTEGER DEFAULT 0,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_take_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  stock_take_id UUID NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
  item_id UUID,
  item_name TEXT NOT NULL,
  item_category TEXT,
  unit TEXT DEFAULT 'pcs',
  system_quantity DECIMAL DEFAULT 0,
  physical_quantity DECIMAL DEFAULT 0,
  discrepancy DECIMAL DEFAULT 0,
  discrepancy_reason TEXT,
  unit_cost DECIMAL DEFAULT 0,
  variance_value DECIMAL DEFAULT 0,
  counted_by TEXT,
  counted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. SHIFT MANAGEMENT
-- =============================================
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shift_number TEXT NOT NULL UNIQUE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_name TEXT NOT NULL,
  employee_role TEXT,
  outlet_id UUID,
  outlet_name TEXT,
  shift_type TEXT DEFAULT 'Regular', -- Regular, Overtime, Split
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  opening_balance DECIMAL DEFAULT 0,
  closing_balance DECIMAL DEFAULT 0,
  total_sales DECIMAL DEFAULT 0,
  cash_sales DECIMAL DEFAULT 0,
  mpesa_sales DECIMAL DEFAULT 0,
  card_sales DECIMAL DEFAULT 0,
  credit_sales DECIMAL DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  total_expenses DECIMAL DEFAULT 0,
  net_cash DECIMAL DEFAULT 0, -- cash_sales - total_expenses
  cash_variance DECIMAL DEFAULT 0, -- closing_balance - (opening_balance + net_cash)
  status TEXT DEFAULT 'Active', -- Active, Ended, Approved
  notes TEXT,
  closed_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shift_expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'General',
  approved_by TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. INSURANCE MODULE
-- =============================================
CREATE TABLE IF NOT EXISTS insurance_policies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  policy_number TEXT NOT NULL UNIQUE,
  policy_type TEXT NOT NULL, -- Vehicle, Asset, Employee, Business, Liability
  provider TEXT NOT NULL,
  provider_contact TEXT,
  provider_email TEXT,
  coverage_type TEXT, -- Comprehensive, Third Party, Fire, Theft, etc.
  premium_amount DECIMAL DEFAULT 0,
  premium_frequency TEXT DEFAULT 'Annual', -- Monthly, Quarterly, Annual
  coverage_amount DECIMAL DEFAULT 0,
  deductible DECIMAL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  renewal_date DATE,
  status TEXT DEFAULT 'Active', -- Active, Expired, Cancelled, Pending, Claimed
  -- Linked entity
  entity_type TEXT, -- Vehicle, Asset, Employee, Outlet
  entity_id UUID,
  entity_name TEXT,
  -- Vehicle specific
  vehicle_registration TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  -- Employee specific
  employee_id_number TEXT,
  benefit_type TEXT, -- WIBA, Group Life, Medical, Pension
  -- Outlet specific
  outlet_id UUID,
  outlet_name TEXT,
  -- Claims
  total_claims INTEGER DEFAULT 0,
  total_claimed_amount DECIMAL DEFAULT 0,
  -- Documents
  document_url TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insurance_claims (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
  claim_number TEXT NOT NULL UNIQUE,
  claim_date DATE NOT NULL,
  incident_date DATE,
  description TEXT NOT NULL,
  claim_amount DECIMAL DEFAULT 0,
  approved_amount DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'Filed', -- Filed, Under Review, Approved, Rejected, Settled
  settlement_date DATE,
  documents_url TEXT,
  adjuster_name TEXT,
  adjuster_contact TEXT,
  notes TEXT,
  filed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. GOVERNMENT INTEGRATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS government_integrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  integration_type TEXT NOT NULL UNIQUE, -- KRA_ETIMS, NSSF, SHA, KRA_PIN
  api_key TEXT,
  api_secret TEXT,
  endpoint_url TEXT,
  business_pin TEXT,
  business_name TEXT,
  registration_number TEXT,
  status TEXT DEFAULT 'Inactive', -- Active, Inactive, Pending, Error
  last_sync TIMESTAMPTZ,
  auto_submit BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tax_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  integration_type TEXT NOT NULL,
  submission_type TEXT NOT NULL, -- Invoice, Return, Payment, Filing
  reference_number TEXT,
  period TEXT, -- e.g., "2026-03"
  amount DECIMAL DEFAULT 0,
  tax_amount DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'Pending', -- Pending, Submitted, Accepted, Rejected, Error
  response_data JSONB DEFAULT '{}',
  submitted_at TIMESTAMPTZ,
  submitted_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. DELIVERY TRACKING ENHANCEMENTS
-- =============================================
-- Add columns to deliveries if not exists
DO $$
BEGIN
  -- Auto-delivery GPS tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='rider_lat') THEN
    ALTER TABLE deliveries ADD COLUMN rider_lat DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='rider_lng') THEN
    ALTER TABLE deliveries ADD COLUMN rider_lng DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='auto_delivered') THEN
    ALTER TABLE deliveries ADD COLUMN auto_delivered BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='customer_confirmed') THEN
    ALTER TABLE deliveries ADD COLUMN customer_confirmed BOOLEAN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='customer_confirmed_at') THEN
    ALTER TABLE deliveries ADD COLUMN customer_confirmed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='complaint_raised') THEN
    ALTER TABLE deliveries ADD COLUMN complaint_raised BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='complaint_text') THEN
    ALTER TABLE deliveries ADD COLUMN complaint_text TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='complaint_at') THEN
    ALTER TABLE deliveries ADD COLUMN complaint_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='pickup_lat') THEN
    ALTER TABLE deliveries ADD COLUMN pickup_lat DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='pickup_lng') THEN
    ALTER TABLE deliveries ADD COLUMN pickup_lng DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='calculated_distance_km') THEN
    ALTER TABLE deliveries ADD COLUMN calculated_distance_km DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='odometer_start') THEN
    ALTER TABLE deliveries ADD COLUMN odometer_start DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='odometer_end') THEN
    ALTER TABLE deliveries ADD COLUMN odometer_end DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='odometer_distance') THEN
    ALTER TABLE deliveries ADD COLUMN odometer_distance DECIMAL;
  END IF;
  -- Branch for delivery
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='branch_id') THEN
    ALTER TABLE deliveries ADD COLUMN branch_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='branch_name') THEN
    ALTER TABLE deliveries ADD COLUMN branch_name TEXT;
  END IF;
END $$;

-- =============================================
-- 6. ORDER CUSTOMER VERIFICATION
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='customer_verified') THEN
    ALTER TABLE orders ADD COLUMN customer_verified BOOLEAN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='customer_verified_at') THEN
    ALTER TABLE orders ADD COLUMN customer_verified_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='complaint_raised') THEN
    ALTER TABLE orders ADD COLUMN complaint_raised BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='complaint_text') THEN
    ALTER TABLE orders ADD COLUMN complaint_text TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='complaint_at') THEN
    ALTER TABLE orders ADD COLUMN complaint_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='verification_code') THEN
    ALTER TABLE orders ADD COLUMN verification_code TEXT;
  END IF;
END $$;

-- =============================================
-- 7. OUTLETS - BRANCH LOCATION FOR DELIVERY
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='outlets' AND column_name='gps_lat') THEN
    ALTER TABLE outlets ADD COLUMN gps_lat DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='outlets' AND column_name='gps_lng') THEN
    ALTER TABLE outlets ADD COLUMN gps_lng DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='outlets' AND column_name='google_maps_url') THEN
    ALTER TABLE outlets ADD COLUMN google_maps_url TEXT;
  END IF;
END $$;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_stock_takes_outlet ON stock_takes(outlet_id);
CREATE INDEX IF NOT EXISTS idx_stock_takes_status ON stock_takes(status);
CREATE INDEX IF NOT EXISTS idx_stock_take_items_stock_take ON stock_take_items(stock_take_id);
CREATE INDEX IF NOT EXISTS idx_shifts_employee ON shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_shifts_outlet ON shifts(outlet_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_type ON insurance_policies(policy_type);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_entity ON insurance_policies(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_status ON insurance_policies(status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_policy ON insurance_claims(policy_id);
CREATE INDEX IF NOT EXISTS idx_tax_submissions_type ON tax_submissions(integration_type);
CREATE INDEX IF NOT EXISTS idx_shift_expenses_shift ON shift_expenses(shift_id);
