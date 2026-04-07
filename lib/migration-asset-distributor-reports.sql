-- =============================================
-- MIGRATION: Asset Management Enhancements, Distribution Agents,
-- Balance Sheet Support, Ledger Entries, Gemini AI Settings
-- =============================================
-- This migration is idempotent: safe to run multiple times.
-- All CREATE TABLE uses IF NOT EXISTS, all ALTER TABLE uses
-- existence checks to avoid errors on re-run.
-- =============================================

-- =============================================
-- 1. ASSETS TABLE - Add missing & new columns
-- =============================================
-- The base 'assets' table is created in supabase-schema.sql.
-- This section adds columns required by the enhanced asset
-- management UI (depreciation, maintenance, service life, etc.).
-- =============================================
DO $$ BEGIN
  -- Depreciation columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'salvage_value') THEN
    ALTER TABLE assets ADD COLUMN salvage_value DECIMAL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'useful_life_years') THEN
    ALTER TABLE assets ADD COLUMN useful_life_years INTEGER DEFAULT 5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'annual_depreciation') THEN
    ALTER TABLE assets ADD COLUMN annual_depreciation DECIMAL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'accumulated_depreciation') THEN
    ALTER TABLE assets ADD COLUMN accumulated_depreciation DECIMAL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'depreciation_method') THEN
    ALTER TABLE assets ADD COLUMN depreciation_method TEXT DEFAULT 'straight_line';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'usage_depreciation_rate') THEN
    ALTER TABLE assets ADD COLUMN usage_depreciation_rate DECIMAL DEFAULT 0;
  END IF;

  -- Warranty & status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'warranty_expiry') THEN
    ALTER TABLE assets ADD COLUMN warranty_expiry DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'status') THEN
    ALTER TABLE assets ADD COLUMN status TEXT DEFAULT 'Active';
  END IF;

  -- Assignment tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'assignment_date') THEN
    ALTER TABLE assets ADD COLUMN assignment_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'assignment_notes') THEN
    ALTER TABLE assets ADD COLUMN assignment_notes TEXT;
  END IF;

  -- Service life & usage tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'service_life_hours') THEN
    ALTER TABLE assets ADD COLUMN service_life_hours DECIMAL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'hours_used') THEN
    ALTER TABLE assets ADD COLUMN hours_used DECIMAL DEFAULT 0;
  END IF;

  -- Maintenance scheduling
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'last_maintenance_date') THEN
    ALTER TABLE assets ADD COLUMN last_maintenance_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'next_maintenance_date') THEN
    ALTER TABLE assets ADD COLUMN next_maintenance_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'maintenance_interval_days') THEN
    ALTER TABLE assets ADD COLUMN maintenance_interval_days INTEGER DEFAULT 0;
  END IF;

  -- Cost tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'maintenance_cost_total') THEN
    ALTER TABLE assets ADD COLUMN maintenance_cost_total DECIMAL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'operating_cost_total') THEN
    ALTER TABLE assets ADD COLUMN operating_cost_total DECIMAL DEFAULT 0;
  END IF;

  -- Legacy columns used by UI (replacement_date mapped as nextServiceDate,
  -- capacity mapped as serviceInterval)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'replacement_date') THEN
    ALTER TABLE assets ADD COLUMN replacement_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'capacity') THEN
    ALTER TABLE assets ADD COLUMN capacity TEXT;
  END IF;
END $$;

-- =============================================
-- 2. ASSET MAINTENANCE LOG
-- =============================================
-- Tracks individual maintenance events for each asset.
-- Used by: app/admin/assets/page.tsx
-- =============================================
CREATE TABLE IF NOT EXISTS asset_maintenance_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL DEFAULT 'Routine',
  description TEXT,
  cost DECIMAL DEFAULT 0,
  performed_by TEXT,
  performed_date DATE DEFAULT CURRENT_DATE,
  next_due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_maintenance_asset ON asset_maintenance_log(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_date ON asset_maintenance_log(performed_date);

-- =============================================
-- 3. ASSET COST LOG
-- =============================================
-- General cost tracking for assets (maintenance, operating, etc.).
-- Created for future use alongside the maintenance log.
-- =============================================
CREATE TABLE IF NOT EXISTS asset_cost_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  cost_type TEXT NOT NULL DEFAULT 'Maintenance',
  description TEXT,
  amount DECIMAL DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_cost_asset ON asset_cost_log(asset_id);

-- =============================================
-- 4. ASSET ASSIGNMENTS
-- =============================================
-- Tracks which employee an asset is assigned to over time.
-- Used by: app/admin/assets/page.tsx
-- =============================================
CREATE TABLE IF NOT EXISTS asset_assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  employee_id TEXT,
  employee_name TEXT,
  assigned_date DATE DEFAULT CURRENT_DATE,
  returned_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_assignments_asset ON asset_assignments(asset_id);

-- =============================================
-- 5. DISTRIBUTION AGENTS
-- =============================================
-- Agents who sell and distribute products on behalf of the bakery.
-- Used by: app/admin/distribution/page.tsx
-- =============================================
CREATE TABLE IF NOT EXISTS distribution_agents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  id_number TEXT,
  address TEXT,
  location TEXT,
  gps_lat DECIMAL,
  gps_lng DECIMAL,
  territory TEXT,
  commission_rate DECIMAL DEFAULT 0,
  commission_type TEXT DEFAULT 'percentage',
  status TEXT DEFAULT 'Active',
  joining_date DATE DEFAULT CURRENT_DATE,
  vehicle_type TEXT,
  vehicle_registration TEXT,
  bank_name TEXT,
  bank_account TEXT,
  total_distributed DECIMAL DEFAULT 0,
  total_commission DECIMAL DEFAULT 0,
  rating DECIMAL DEFAULT 5,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distribution_agents_status ON distribution_agents(status);

-- =============================================
-- 6. DISTRIBUTION RECORDS
-- =============================================
-- Individual distribution events linked to agents.
-- Used by: app/admin/distribution/page.tsx
-- =============================================
CREATE TABLE IF NOT EXISTS distribution_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES distribution_agents(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity DECIMAL DEFAULT 0,
  unit TEXT DEFAULT 'pieces',
  unit_price DECIMAL DEFAULT 0,
  total_amount DECIMAL DEFAULT 0,
  commission_amount DECIMAL DEFAULT 0,
  distribution_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'Pending',
  return_quantity DECIMAL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distribution_records_agent ON distribution_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_distribution_records_date ON distribution_records(distribution_date);

-- =============================================
-- 7. LEDGER ENTRIES
-- =============================================
-- General-purpose double-entry ledger for balance sheet and
-- financial reporting.
-- Used by: app/admin/reports/page.tsx
-- =============================================
CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  entry_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  account TEXT NOT NULL,
  debit DECIMAL DEFAULT 0,
  credit DECIMAL DEFAULT 0,
  reference TEXT,
  category TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_date ON ledger_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account ON ledger_entries(account);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_category ON ledger_entries(category);

-- =============================================
-- 8. DISTRIBUTORS (Supplier Management)
-- =============================================
-- Inventory suppliers / distributors.
-- The base table is created here with IF NOT EXISTS, then extra
-- columns are added via ALTER TABLE with existence checks.
-- Used by: app/admin/distributors/page.tsx, app/admin/inventory/page.tsx
-- =============================================
CREATE TABLE IF NOT EXISTS distributors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  location TEXT,
  category TEXT,
  status TEXT DEFAULT 'Active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'distributors' AND column_name = 'company_name') THEN
    ALTER TABLE distributors ADD COLUMN company_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'distributors' AND column_name = 'contact_person') THEN
    ALTER TABLE distributors ADD COLUMN contact_person TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'distributors' AND column_name = 'gps_lat') THEN
    ALTER TABLE distributors ADD COLUMN gps_lat DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'distributors' AND column_name = 'gps_lng') THEN
    ALTER TABLE distributors ADD COLUMN gps_lng DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'distributors' AND column_name = 'products') THEN
    ALTER TABLE distributors ADD COLUMN products TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'distributors' AND column_name = 'payment_terms') THEN
    ALTER TABLE distributors ADD COLUMN payment_terms TEXT DEFAULT 'Net 30';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'distributors' AND column_name = 'rating') THEN
    ALTER TABLE distributors ADD COLUMN rating DECIMAL DEFAULT 5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'distributors' AND column_name = 'website') THEN
    ALTER TABLE distributors ADD COLUMN website TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'distributors' AND column_name = 'contacts') THEN
    ALTER TABLE distributors ADD COLUMN contacts JSONB DEFAULT '[]';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_distributors_status ON distributors(status);
CREATE INDEX IF NOT EXISTS idx_distributors_category ON distributors(category);

-- =============================================
-- 9. DISTRIBUTOR CATEGORIES
-- =============================================
-- Categories for grouping suppliers.
-- Used by: app/admin/distributors/page.tsx
-- =============================================
CREATE TABLE IF NOT EXISTS distributor_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 10. COST ENTRIES - Add cost_type for P&L breakdown
-- =============================================
-- The base cost_entries table is in supabase-schema.sql.
-- This adds a cost_type column for categorising expenses.
-- Used by: app/admin/reports/page.tsx
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cost_entries' AND column_name = 'cost_type') THEN
    ALTER TABLE cost_entries ADD COLUMN cost_type TEXT DEFAULT 'general_expense';
  END IF;
END $$;

-- =============================================
-- 11. RECIPE INGREDIENTS - Add sourcing_note
-- =============================================
-- The base recipe_ingredients table is in supabase-schema.sql.
-- This adds a sourcing_note column for ingredient sourcing info.
-- Used by: app/admin/recipes/page.tsx
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recipe_ingredients' AND column_name = 'sourcing_note') THEN
    ALTER TABLE recipe_ingredients ADD COLUMN sourcing_note TEXT;
  END IF;
END $$;

-- Done
