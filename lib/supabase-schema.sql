-- =============================================
-- BAKERY MANAGEMENT SYSTEM - COMPLETE SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- No RLS policies — add later as needed
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. USERS & AUTH
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role_id UUID,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. ROLES & PERMISSIONS
-- =============================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- FK: users -> roles
ALTER TABLE users ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;

-- =============================================
-- 3. EMPLOYEES / HR
-- =============================================
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id_number TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  designation TEXT DEFAULT 'Mr',
  email TEXT,
  phone TEXT,
  department TEXT,
  role TEXT,
  category TEXT DEFAULT 'Baker',
  hire_date DATE,
  status TEXT DEFAULT 'Active',
  next_of_kin TEXT,
  next_of_kin_phone TEXT,
  postal_address TEXT,
  postal_code TEXT,
  town TEXT,
  id_number TEXT,
  profile_photo_url TEXT,
  driver_license_id TEXT,
  driver_license_expiry DATE,
  hygiene_cert_no TEXT,
  hygiene_cert_expiry DATE,
  certificates JSONB DEFAULT '[]',
  bank_name TEXT,
  bank_account_no TEXT,
  nhif_no TEXT,
  nssf_no TEXT,
  kra_pin TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  notes TEXT,
  system_access BOOLEAN DEFAULT false,
  login_email TEXT,
  login_role TEXT DEFAULT 'Viewer',
  permissions JSONB DEFAULT '[]',
  primary_outlet_id UUID,
  primary_outlet_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_certificates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  number TEXT,
  issue_date DATE,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. PRODUCT CATEGORIES & RECIPES
-- =============================================
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  product_type TEXT,
  batch_size INTEGER DEFAULT 1,
  expected_output INTEGER DEFAULT 0,
  output_unit TEXT DEFAULT 'pieces',
  instructions TEXT,
  prep_time INTEGER DEFAULT 0,
  bake_time INTEGER DEFAULT 0,
  bake_temp INTEGER DEFAULT 180,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'g',
  cost_per_unit DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. FOOD INFO (PRODUCT CATALOGUE)
-- =============================================
CREATE TABLE IF NOT EXISTS food_info (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_name TEXT NOT NULL,
  code TEXT,
  image_url TEXT,
  allergens TEXT[] DEFAULT '{}',
  calories DECIMAL DEFAULT 0,
  protein DECIMAL DEFAULT 0,
  fat DECIMAL DEFAULT 0,
  carbs DECIMAL DEFAULT 0,
  shelf_life_days INTEGER DEFAULT 0,
  certification TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. INVENTORY
-- =============================================
CREATE TABLE IF NOT EXISTS inventory_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'Consumable',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'Consumable',
  category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
  category TEXT,
  quantity DECIMAL DEFAULT 0,
  unit TEXT DEFAULT 'kg',
  unit_cost DECIMAL DEFAULT 0,
  reorder_level DECIMAL DEFAULT 0,
  reorder_qty DECIMAL DEFAULT 0,
  auto_reorder BOOLEAN DEFAULT false,
  supplier TEXT,
  distributor_id UUID,
  last_restocked DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  quantity DECIMAL NOT NULL,
  reference TEXT,
  notes TEXT,
  performed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. CUSTOMERS
-- =============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'Retail',
  phone TEXT,
  email TEXT,
  location TEXT,
  address TEXT,
  gps_lat DECIMAL DEFAULT 0,
  gps_lng DECIMAL DEFAULT 0,
  landmark TEXT,
  delivery_instructions TEXT,
  credit_limit DECIMAL DEFAULT 0,
  purchase_volume DECIMAL DEFAULT 0,
  rating DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'Active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 8. ORDERS
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  status TEXT DEFAULT 'Pending',
  total_amount DECIMAL DEFAULT 0,
  payment_status TEXT DEFAULT 'Unpaid',
  payment_method TEXT,
  source TEXT DEFAULT 'Regular',
  fulfillment TEXT DEFAULT 'Delivery',
  rejection_reason TEXT,
  order_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  assigned_driver TEXT,
  delivery_notes TEXT,
  pos_sale_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity DECIMAL NOT NULL,
  unit_price DECIMAL NOT NULL,
  total DECIMAL NOT NULL,
  is_non_inventory BOOLEAN DEFAULT false,
  unit_cost DECIMAL DEFAULT 0,
  cost_total DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 9. DELIVERIES
-- =============================================
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tracking_number TEXT UNIQUE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  destination TEXT,
  driver TEXT,
  driver_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  vehicle TEXT,
  status TEXT DEFAULT 'Pending',
  scheduled_date DATE,
  delivered_at TIMESTAMPTZ,
  items_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 10. PRICING
-- =============================================
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_code TEXT,
  product_name TEXT NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  recipe_name TEXT,
  cost DECIMAL DEFAULT 0,
  base_price DECIMAL DEFAULT 0,
  wholesale_price DECIMAL DEFAULT 0,
  retail_price DECIMAL DEFAULT 0,
  margin DECIMAL DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: Add recipe_id and recipe_name if they don't already exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_tiers' AND column_name = 'recipe_id') THEN
    ALTER TABLE pricing_tiers ADD COLUMN recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_tiers' AND column_name = 'recipe_name') THEN
    ALTER TABLE pricing_tiers ADD COLUMN recipe_name TEXT;
  END IF;
END $$;

-- =============================================
-- 11. PRODUCTION RUNS
-- =============================================
CREATE TABLE IF NOT EXISTS production_runs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  recipe_code TEXT,
  batch_size DECIMAL DEFAULT 0,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  yield_qty DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'scheduled',
  operator TEXT,
  operator_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 12. PICKING LISTS
-- =============================================
CREATE TABLE IF NOT EXISTS picking_lists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipe_code TEXT,
  batch_size DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS picking_list_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  picking_list_id UUID NOT NULL REFERENCES picking_lists(id) ON DELETE CASCADE,
  ingredient TEXT NOT NULL,
  quantity DECIMAL NOT NULL,
  unit TEXT DEFAULT 'kg',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 13. LOT TRACKING
-- =============================================
CREATE TABLE IF NOT EXISTS lot_tracking (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lot_number TEXT UNIQUE,
  product_code TEXT,
  product_name TEXT NOT NULL,
  batch_date DATE,
  quantity DECIMAL DEFAULT 0,
  unit TEXT DEFAULT 'units',
  expiration_date DATE,
  location TEXT,
  status TEXT DEFAULT 'active',
  supplier TEXT,
  batch_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 14. WASTE CONTROL
-- =============================================
CREATE TABLE IF NOT EXISTS waste_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  product_code TEXT,
  product_name TEXT,
  quantity DECIMAL DEFAULT 0,
  unit TEXT DEFAULT 'units',
  reason TEXT,
  category TEXT DEFAULT 'Raw Materials',
  cost DECIMAL DEFAULT 0,
  batch_number TEXT,
  notes TEXT,
  reported_by TEXT,
  approval_status TEXT DEFAULT 'Pending',
  approved_by TEXT,
  approval_date DATE,
  approval_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 15. PURCHASING
-- =============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  po_number TEXT UNIQUE,
  supplier TEXT NOT NULL,
  order_date DATE DEFAULT CURRENT_DATE,
  delivery_date DATE,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id TEXT,
  ingredient TEXT NOT NULL,
  quantity DECIMAL NOT NULL,
  unit TEXT DEFAULT 'kg',
  unit_price DECIMAL DEFAULT 0,
  total DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 16. ASSETS
-- =============================================
CREATE TABLE IF NOT EXISTS asset_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  category_id UUID REFERENCES asset_categories(id) ON DELETE SET NULL,
  category TEXT,
  serial_number TEXT,
  purchase_date DATE,
  purchase_price DECIMAL DEFAULT 0,
  current_value DECIMAL DEFAULT 0,
  condition TEXT DEFAULT 'Good',
  location TEXT,
  assigned_to TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 17. DEBTORS
-- =============================================
CREATE TABLE IF NOT EXISTS debtors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  total_debt DECIMAL DEFAULT 0,
  debt_days INTEGER DEFAULT 0,
  last_payment_date DATE,
  last_payment_amount DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'Current',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS debtor_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  debtor_id UUID NOT NULL REFERENCES debtors(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 18. CREDITORS
-- =============================================
CREATE TABLE IF NOT EXISTS creditors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  total_credit DECIMAL DEFAULT 0,
  credit_days INTEGER DEFAULT 0,
  next_payment_date DATE,
  last_payment_date DATE,
  status TEXT DEFAULT 'Current',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS creditor_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creditor_id UUID NOT NULL REFERENCES creditors(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 19. POS SALES
-- =============================================
CREATE TABLE IF NOT EXISTS pos_sales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  receipt_number TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT DEFAULT 'Walk-in Customer',
  sale_type TEXT DEFAULT 'Retail',
  payment_method TEXT DEFAULT 'Cash',
  mpesa_reference TEXT,
  mpesa_phone TEXT,
  subtotal DECIMAL DEFAULT 0,
  tax DECIMAL DEFAULT 0,
  discount DECIMAL DEFAULT 0,
  total DECIMAL DEFAULT 0,
  amount_paid DECIMAL DEFAULT 0,
  change_amount DECIMAL DEFAULT 0,
  cashier_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  cashier_name TEXT,
  status TEXT DEFAULT 'Completed',
  outlet_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_sale_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  sku TEXT,
  quantity DECIMAL NOT NULL,
  unit_price DECIMAL NOT NULL,
  total DECIMAL NOT NULL,
  is_non_inventory BOOLEAN DEFAULT false,
  unit_cost DECIMAL DEFAULT 0,
  cost_total DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 20. M-PESA TRANSACTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  checkout_request_id TEXT,
  merchant_request_id TEXT,
  phone TEXT,
  amount DECIMAL NOT NULL,
  mpesa_receipt TEXT,
  result_code INTEGER,
  result_desc TEXT,
  sale_id UUID REFERENCES pos_sales(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 21. P&L / ACCOUNTING
-- =============================================
CREATE TABLE IF NOT EXISTS pl_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  period TEXT NOT NULL,
  revenue DECIMAL DEFAULT 0,
  costs DECIMAL DEFAULT 0,
  profit DECIMAL DEFAULT 0,
  margin DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cost_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  description TEXT,
  amount DECIMAL NOT NULL,
  payment_status TEXT DEFAULT 'Paid',
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revenue_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  source TEXT NOT NULL,
  description TEXT,
  amount DECIMAL NOT NULL,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 22. OFFERS / PROMOTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS offers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT DEFAULT '/shop',
  badge_text TEXT DEFAULT 'Limited Time',
  discount_text TEXT,
  product_id TEXT,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offers_active ON offers(is_active, start_date, end_date);

-- =============================================
-- 24. SETTINGS
-- =============================================
CREATE TABLE IF NOT EXISTS settings_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings_ingredients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'kg',
  cost_per_unit DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings_menu_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  price DECIMAL DEFAULT 0,
  category_id UUID REFERENCES settings_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 25. AUDIT LOG
-- =============================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_employees_category ON employees(category);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_pos_sales_date ON pos_sales(created_at);
CREATE INDEX IF NOT EXISTS idx_pos_sales_customer ON pos_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_method ON pos_sales(payment_method);
CREATE INDEX IF NOT EXISTS idx_production_runs_status ON production_runs(status);
CREATE INDEX IF NOT EXISTS idx_lot_tracking_status ON lot_tracking(status);
CREATE INDEX IF NOT EXISTS idx_lot_tracking_expiration ON lot_tracking(expiration_date);
CREATE INDEX IF NOT EXISTS idx_waste_records_date ON waste_records(date);
CREATE INDEX IF NOT EXISTS idx_debtors_status ON debtors(status);
CREATE INDEX IF NOT EXISTS idx_creditors_status ON creditors(status);
CREATE INDEX IF NOT EXISTS idx_mpesa_checkout ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_module ON audit_log(module);
CREATE INDEX IF NOT EXISTS idx_audit_log_date ON audit_log(created_at);

-- =============================================
-- 26. M-PESA API SETTINGS (Database Backup)
-- Primary source: .env environment variables
-- This table stores a backup copy of credentials
-- =============================================
CREATE TABLE IF NOT EXISTS mpesa_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL DEFAULT '',
  description TEXT,
  is_sensitive BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mpesa_settings_key ON mpesa_settings(setting_key);

-- =============================================
-- SEED: Default roles & permissions
-- =============================================
INSERT INTO roles (name, description) VALUES
  ('Administrator', 'Full system access'),
  ('Manager', 'Can manage production and employees'),
  ('Baker', 'Production floor access'),
  ('Driver', 'Delivery and order viewing'),
  ('Cashier', 'POS access only')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, category) VALUES
  ('View Dashboard', 'Access dashboard analytics', 'Dashboard'),
  ('Manage Recipes', 'Create, edit, delete recipes', 'Recipes'),
  ('View Production', 'View production reports', 'Production'),
  ('Manage Production', 'Create and manage production runs', 'Production'),
  ('Manage Orders', 'Create and manage customer orders', 'Orders'),
  ('View Orders', 'View customer orders', 'Orders'),
  ('Manage Employees', 'Create, edit, delete employees', 'Employees'),
  ('Access POS', 'Use POS system', 'POS'),
  ('Manage Inventory', 'Manage inventory items', 'Inventory'),
  ('View Reports', 'View system reports', 'Admin'),
  ('Manage Users', 'Create and manage system users', 'Admin'),
  ('System Settings', 'Manage system configuration', 'Admin'),
  ('Manage Deliveries', 'Create and manage deliveries', 'Delivery'),
  ('View Deliveries', 'View delivery information', 'Delivery'),
  ('Manage Finance', 'Access debtors, creditors, P&L', 'Finance'),
  ('View Finance', 'View financial reports', 'Finance')
ON CONFLICT (name) DO NOTHING;

-- Seed walk-in customer
INSERT INTO customers (name, type, phone, location) VALUES
  ('Walk-in Customer', 'Retail', '', 'Counter')
ON CONFLICT DO NOTHING;

-- =============================================
-- 27. EMPLOYEE CATEGORIES
-- =============================================
CREATE TABLE IF NOT EXISTS employee_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO employee_categories (name) VALUES
  ('Baker'), ('Driver'), ('Sales'), ('Admin'),
  ('Quality'), ('Packer'), ('Supervisor'), ('Manager'),
  ('Rider'), ('Cleaner'), ('Cashier'), ('Outlet Staff'),
  ('Accounts and Finance'), ('Intern')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 28. BUSINESS SETTINGS (KEY-VALUE)
-- =============================================
CREATE TABLE IF NOT EXISTS business_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEX: employee login_email for fast lookups
-- =============================================
CREATE INDEX IF NOT EXISTS idx_employees_login_email ON employees(login_email);
CREATE INDEX IF NOT EXISTS idx_employees_system_access ON employees(system_access);
