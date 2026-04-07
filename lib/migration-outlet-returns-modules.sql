-- =============================================
-- OUTLET RETURNS & BRANCH MODULES - MIGRATION
-- Run this in your Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. OUTLET RETURNS TABLE
-- Tracks returns from branches back to main bakery
-- Based on freshness policy: max 2 days at branch
-- Total product freshness: ~5 days
-- =============================================
CREATE TABLE IF NOT EXISTS outlet_returns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  return_number TEXT UNIQUE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  outlet_name TEXT,
  returned_by TEXT,
  returned_by_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  received_by TEXT,
  received_by_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Pending',  -- 'Pending', 'In_Transit', 'Received', 'Inspected', 'Processed', 'Rejected'
  return_reason TEXT DEFAULT 'Freshness Policy',  -- 'Freshness Policy', 'Overstock', 'Quality Issue', 'Damaged', 'Expired', 'Other'
  total_items INTEGER DEFAULT 0,
  total_value DECIMAL DEFAULT 0,
  wholesale_value DECIMAL DEFAULT 0,  -- estimated wholesale resale value
  return_date DATE DEFAULT CURRENT_DATE,
  received_date DATE,
  inspection_notes TEXT,
  quality_grade TEXT,  -- 'A - Fresh (3+ days left)', 'B - Good (2 days left)', 'C - Sell Today', 'D - Waste'
  destination TEXT DEFAULT 'wholesale',  -- 'wholesale', 'discount_sale', 'waste', 'redistribution'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlet_returns_outlet ON outlet_returns(outlet_id);
CREATE INDEX IF NOT EXISTS idx_outlet_returns_status ON outlet_returns(status);
CREATE INDEX IF NOT EXISTS idx_outlet_returns_date ON outlet_returns(return_date);

-- =============================================
-- 2. OUTLET RETURN ITEMS
-- Individual items in a return
-- =============================================
CREATE TABLE IF NOT EXISTS outlet_return_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  return_id UUID NOT NULL REFERENCES outlet_returns(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_code TEXT,
  quantity_sent DECIMAL NOT NULL DEFAULT 0,      -- original quantity sent to branch
  quantity_sold DECIMAL DEFAULT 0,                -- how many were sold
  quantity_returning DECIMAL NOT NULL DEFAULT 0,  -- how many being returned
  unit TEXT DEFAULT 'pieces',
  unit_cost DECIMAL DEFAULT 0,
  total_cost DECIMAL DEFAULT 0,
  batch_number TEXT,
  date_received_at_branch DATE,                   -- when the branch received it
  days_at_branch INTEGER DEFAULT 0,               -- calculated days at branch
  shelf_life_remaining INTEGER DEFAULT 0,          -- estimated days of freshness left
  quality_on_return TEXT DEFAULT 'Good',           -- 'Excellent', 'Good', 'Fair', 'Poor', 'Waste'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlet_return_items_return ON outlet_return_items(return_id);

-- =============================================
-- 3. OUTLET PRODUCTS TABLE
-- Branch-specific product catalog
-- Branches have their own products + requisitioned ones
-- =============================================
CREATE TABLE IF NOT EXISTS outlet_products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_code TEXT,
  category TEXT DEFAULT 'General',
  description TEXT,
  image_url TEXT,
  retail_price DECIMAL DEFAULT 0,
  wholesale_price DECIMAL DEFAULT 0,
  cost_price DECIMAL DEFAULT 0,
  current_stock DECIMAL DEFAULT 0,
  stock_unit TEXT DEFAULT 'pieces',
  reorder_level DECIMAL DEFAULT 5,
  shelf_life_days INTEGER DEFAULT 3,
  is_from_bakery BOOLEAN DEFAULT false,  -- true if requisitioned from main bakery
  bakery_product_id UUID,  -- references food_info.id if from bakery
  is_active BOOLEAN DEFAULT true,
  barcode TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlet_products_outlet ON outlet_products(outlet_id);
CREATE INDEX IF NOT EXISTS idx_outlet_products_category ON outlet_products(category);
CREATE INDEX IF NOT EXISTS idx_outlet_products_active ON outlet_products(is_active);

-- =============================================
-- 4. OUTLET WASTE RECORDS
-- Branch-specific waste tracking
-- =============================================
CREATE TABLE IF NOT EXISTS outlet_waste_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  outlet_name TEXT,
  date DATE DEFAULT CURRENT_DATE,
  product_name TEXT NOT NULL,
  product_code TEXT,
  quantity DECIMAL NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'units',
  reason TEXT NOT NULL,  -- 'Quality defect', 'Expiration', 'Damaged', 'Customer return', 'Overproduction', 'Spillage'
  category TEXT DEFAULT 'Finished Goods',  -- 'Finished Goods', 'Returns', 'Packaging', 'Supplies'
  cost DECIMAL DEFAULT 0,
  batch_number TEXT,
  reported_by TEXT,
  reported_by_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  approval_status TEXT DEFAULT 'Pending',  -- 'Pending', 'Approved', 'Rejected'
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlet_waste_outlet ON outlet_waste_records(outlet_id);
CREATE INDEX IF NOT EXISTS idx_outlet_waste_date ON outlet_waste_records(date);
CREATE INDEX IF NOT EXISTS idx_outlet_waste_status ON outlet_waste_records(approval_status);

-- =============================================
-- 5. OUTLET SETTINGS TABLE
-- Branch-specific settings (receipt, display, etc.)
-- Limited settings compared to main system
-- =============================================
CREATE TABLE IF NOT EXISTS outlet_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  key TEXT NOT NULL,  -- 'receipt', 'display', 'pos', 'notifications'
  value JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE(outlet_id, key)
);

CREATE INDEX IF NOT EXISTS idx_outlet_settings_outlet ON outlet_settings(outlet_id);

-- =============================================
-- 6. ADD freshness columns to outlet_inventory
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outlet_inventory' AND column_name = 'received_date') THEN
    ALTER TABLE outlet_inventory ADD COLUMN received_date DATE DEFAULT CURRENT_DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outlet_inventory' AND column_name = 'shelf_life_days') THEN
    ALTER TABLE outlet_inventory ADD COLUMN shelf_life_days INTEGER DEFAULT 5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outlet_inventory' AND column_name = 'max_days_at_branch') THEN
    ALTER TABLE outlet_inventory ADD COLUMN max_days_at_branch INTEGER DEFAULT 2;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outlet_inventory' AND column_name = 'batch_number') THEN
    ALTER TABLE outlet_inventory ADD COLUMN batch_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outlet_inventory' AND column_name = 'production_date') THEN
    ALTER TABLE outlet_inventory ADD COLUMN production_date DATE;
  END IF;
END $$;

-- =============================================
-- SEED: Default permissions for new modules
-- =============================================
INSERT INTO permissions (name, description, category) VALUES
  ('Manage Outlet Returns', 'Create and manage branch returns to main bakery', 'Outlets'),
  ('Process Outlet Returns', 'Receive and inspect returned items at main bakery', 'Outlets'),
  ('Manage Outlet Products', 'Manage branch-specific product catalog', 'Outlets'),
  ('Manage Outlet Waste', 'Record and manage branch waste records', 'Outlets'),
  ('Approve Outlet Waste', 'Approve or reject branch waste reports', 'Outlets'),
  ('Manage Outlet Settings', 'Configure branch-specific settings', 'Outlets'),
  ('View Outlet Reports', 'View branch-specific reports and analytics', 'Outlets')
ON CONFLICT (name) DO NOTHING;
