-- =============================================
-- OUTLET MANAGEMENT MODULE - MIGRATION
-- Run this in your Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. OUTLETS TABLE
-- Main table for all business outlets (branches)
-- The main bakery is outlet_type = 'bakery' (main branch)
-- Other outlets are coffee shops, retail stores etc.
-- =============================================
CREATE TABLE IF NOT EXISTS outlets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  outlet_type TEXT DEFAULT 'retail',  -- 'bakery' (main), 'coffee_shop', 'retail', 'restaurant'
  is_main_branch BOOLEAN DEFAULT false,
  address TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  manager_name TEXT,
  opening_hours TEXT,
  status TEXT DEFAULT 'Active',  -- Active, Inactive, Closed, Suspended
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlets_status ON outlets(status);
CREATE INDEX IF NOT EXISTS idx_outlets_type ON outlets(outlet_type);
CREATE INDEX IF NOT EXISTS idx_outlets_is_main ON outlets(is_main_branch);

-- =============================================
-- 2. OUTLET EMPLOYEES (Assignment Table)
-- Maps employees to outlets with outlet-specific roles
-- An employee can be assigned to multiple outlets
-- =============================================
CREATE TABLE IF NOT EXISTS outlet_employees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  outlet_role TEXT DEFAULT 'Staff',  -- 'Admin', 'Manager', 'Cashier', 'Barista', 'Server', 'Staff'
  is_outlet_admin BOOLEAN DEFAULT false,
  permissions JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'Active',  -- Active, Inactive, Transferred
  assigned_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(outlet_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_outlet_employees_outlet ON outlet_employees(outlet_id);
CREATE INDEX IF NOT EXISTS idx_outlet_employees_employee ON outlet_employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_outlet_employees_role ON outlet_employees(outlet_role);

-- =============================================
-- 3. OUTLET INVENTORY
-- Separate inventory for each outlet
-- Does NOT affect main bakery inventory
-- =============================================
CREATE TABLE IF NOT EXISTS outlet_inventory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  quantity DECIMAL DEFAULT 0,
  unit TEXT DEFAULT 'pieces',
  unit_cost DECIMAL DEFAULT 0,
  selling_price DECIMAL DEFAULT 0,
  reorder_level DECIMAL DEFAULT 0,
  supplier TEXT,
  source TEXT DEFAULT 'main_branch',  -- 'main_branch', 'external', 'self'
  last_restocked DATE,
  status TEXT DEFAULT 'Active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlet_inventory_outlet ON outlet_inventory(outlet_id);
CREATE INDEX IF NOT EXISTS idx_outlet_inventory_category ON outlet_inventory(category);

-- =============================================
-- 4. OUTLET INVENTORY TRANSACTIONS
-- Track all stock movements for outlet inventory
-- =============================================
CREATE TABLE IF NOT EXISTS outlet_inventory_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES outlet_inventory(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'intake', 'output', 'adjustment', 'requisition_received', 'sale', 'waste'
  quantity DECIMAL NOT NULL,
  reference TEXT,
  notes TEXT,
  performed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlet_inv_txn_outlet ON outlet_inventory_transactions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_outlet_inv_txn_item ON outlet_inventory_transactions(item_id);

-- =============================================
-- 5. OUTLET REQUISITIONS
-- Outlets request products/items from main bakery
-- =============================================
CREATE TABLE IF NOT EXISTS outlet_requisitions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  requisition_number TEXT UNIQUE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  outlet_name TEXT,
  requested_by TEXT,
  requested_by_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Pending',  -- 'Pending', 'Approved', 'Partially_Fulfilled', 'Fulfilled', 'Rejected', 'Cancelled'
  priority TEXT DEFAULT 'Normal',  -- 'Low', 'Normal', 'High', 'Urgent'
  needed_by DATE,
  approved_by TEXT,
  approved_by_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  total_items INTEGER DEFAULT 0,
  total_cost DECIMAL DEFAULT 0,
  delivery_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlet_req_outlet ON outlet_requisitions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_outlet_req_status ON outlet_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_outlet_req_date ON outlet_requisitions(created_at);

-- =============================================
-- 6. OUTLET REQUISITION ITEMS
-- Individual items in a requisition
-- =============================================
CREATE TABLE IF NOT EXISTS outlet_requisition_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  requisition_id UUID NOT NULL REFERENCES outlet_requisitions(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_code TEXT,
  quantity_requested DECIMAL NOT NULL DEFAULT 0,
  quantity_approved DECIMAL DEFAULT 0,
  quantity_fulfilled DECIMAL DEFAULT 0,
  unit TEXT DEFAULT 'pieces',
  unit_cost DECIMAL DEFAULT 0,
  total_cost DECIMAL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlet_req_items_req ON outlet_requisition_items(requisition_id);

-- =============================================
-- 7. OUTLET POS SALES
-- Track outlet-specific POS sales
-- Uses same structure as main pos_sales but linked to outlet
-- =============================================
-- Add outlet_id column to existing pos_sales table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pos_sales' AND column_name = 'outlet_id') THEN
    ALTER TABLE pos_sales ADD COLUMN outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pos_sales_outlet ON pos_sales(outlet_id);

-- =============================================
-- 8. OUTLET ORDERS
-- Add outlet_id to orders table
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'outlet_id') THEN
    ALTER TABLE orders ADD COLUMN outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_outlet ON orders(outlet_id);

-- =============================================
-- 9. ADD OUTLET COLUMNS TO EMPLOYEES TABLE
-- Track which outlet(s) an employee belongs to
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'primary_outlet_id') THEN
    ALTER TABLE employees ADD COLUMN primary_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'primary_outlet_name') THEN
    ALTER TABLE employees ADD COLUMN primary_outlet_name TEXT;
  END IF;
END $$;

-- =============================================
-- 10. OUTLET TRANSFER LOG
-- Track transfers of stock between outlets
-- =============================================
CREATE TABLE IF NOT EXISTS outlet_transfers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transfer_number TEXT UNIQUE,
  from_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
  to_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
  from_outlet_name TEXT,
  to_outlet_name TEXT,
  status TEXT DEFAULT 'Pending',  -- 'Pending', 'In_Transit', 'Received', 'Cancelled'
  initiated_by TEXT,
  received_by TEXT,
  total_items INTEGER DEFAULT 0,
  total_value DECIMAL DEFAULT 0,
  transfer_date DATE DEFAULT CURRENT_DATE,
  received_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outlet_transfer_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES outlet_transfers(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity DECIMAL NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'pieces',
  unit_cost DECIMAL DEFAULT 0,
  total_cost DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlet_transfers_from ON outlet_transfers(from_outlet_id);
CREATE INDEX IF NOT EXISTS idx_outlet_transfers_to ON outlet_transfers(to_outlet_id);
CREATE INDEX IF NOT EXISTS idx_outlet_transfers_status ON outlet_transfers(status);

-- =============================================
-- SEED: Default permissions for outlet management
-- =============================================
INSERT INTO permissions (name, description, category) VALUES
  ('Manage Outlets', 'Create, edit, delete outlets and manage outlet operations', 'Outlets'),
  ('View Outlets', 'View outlet information and reports', 'Outlets'),
  ('Manage Outlet Inventory', 'Manage outlet-specific inventory', 'Outlets'),
  ('Manage Requisitions', 'Create and manage outlet requisitions from main branch', 'Outlets'),
  ('Approve Requisitions', 'Approve or reject outlet requisitions', 'Outlets')
ON CONFLICT (name) DO NOTHING;
