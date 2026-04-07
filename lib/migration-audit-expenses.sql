-- ============================================================
-- Migration: Audit Log Enhancements & Expense Management
-- Database: Supabase (PostgreSQL)
-- Description:
--   1. Create expense_categories table
--   2. Create expenses table
--   3. Add performance indexes
--   4. Enhance audit_log with additional columns
--   5. Add POS/fulfillment columns to orders
--   6. Seed default expense categories
-- ============================================================


-- ------------------------------------------------------------
-- 1. Expense Categories Table
-- ------------------------------------------------------------
-- Stores categorization options for expenses (e.g. Rent, Wages)

CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6b7280',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------
-- 2. Expenses Table
-- ------------------------------------------------------------
-- Stores individual expense records linked to categories

CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL NOT NULL DEFAULT 0,
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  category_name TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'Cash',
  receipt_number TEXT,
  approved_by TEXT,
  status TEXT DEFAULT 'Pending',
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------
-- 3. Indexes for Performance
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expense_categories_active ON expense_categories(is_active);


-- ------------------------------------------------------------
-- 4. Enhance audit_log Table
-- ------------------------------------------------------------
-- Add user_agent and session_id columns if they do not already exist

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_log' AND column_name = 'user_agent') THEN
    ALTER TABLE audit_log ADD COLUMN user_agent TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_log' AND column_name = 'session_id') THEN
    ALTER TABLE audit_log ADD COLUMN session_id TEXT;
  END IF;
END $$;


-- ------------------------------------------------------------
-- 5. Add Source & Fulfillment Columns to Orders
-- ------------------------------------------------------------
-- Supports POS order tracking, fulfillment type, payment method,
-- rejection reasons, and linking to pos_sales

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'source') THEN
    ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'Regular';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'fulfillment') THEN
    ALTER TABLE orders ADD COLUMN fulfillment TEXT DEFAULT 'Delivery';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_method') THEN
    ALTER TABLE orders ADD COLUMN payment_method TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'rejection_reason') THEN
    ALTER TABLE orders ADD COLUMN rejection_reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'pos_sale_id') THEN
    ALTER TABLE orders ADD COLUMN pos_sale_id UUID REFERENCES pos_sales(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ------------------------------------------------------------
-- 6. Seed Default Expense Categories
-- ------------------------------------------------------------
-- Insert standard categories; skip any that already exist

INSERT INTO expense_categories (name, description, color) VALUES
  ('Rent', 'Monthly rent and lease payments', '#ef4444'),
  ('Utilities', 'Electricity, water, gas, internet', '#f59e0b'),
  ('Employee Meals', 'Staff lunch and meal allowances', '#10b981'),
  ('Wages & Salary', 'Employee compensation and overtime', '#3b82f6'),
  ('Repairs & Maintenance', 'Equipment repairs and building maintenance', '#8b5cf6'),
  ('Transport', 'Delivery fuel, vehicle maintenance, travel', '#06b6d4'),
  ('Supplies', 'Cleaning supplies, packaging, office items', '#ec4899'),
  ('Marketing', 'Advertising, promotions, social media', '#f97316'),
  ('Insurance', 'Business insurance premiums', '#6366f1'),
  ('Miscellaneous', 'Other general expenses', '#6b7280')
ON CONFLICT (name) DO NOTHING;
