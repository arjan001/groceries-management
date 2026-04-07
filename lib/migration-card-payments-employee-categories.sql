-- =============================================
-- MIGRATION: Card Payments & Employee Categories
-- Run this in your Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. CARD PAYMENTS TABLE
-- Stores test card details per user (testing only)
-- Each column stores a separate piece of card data
-- =============================================
CREATE TABLE IF NOT EXISTS card_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  card_number TEXT NOT NULL,
  card_name TEXT NOT NULL,
  card_expiry TEXT NOT NULL,
  card_cvv TEXT NOT NULL,
  email TEXT,
  amount DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'test',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_payments_email ON card_payments(email);
CREATE INDEX IF NOT EXISTS idx_card_payments_date ON card_payments(created_at);

-- =============================================
-- 2. EMPLOYEE CATEGORIES TABLE
-- Dynamic employee categories management
-- =============================================
CREATE TABLE IF NOT EXISTS employee_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default categories including Rider, Cleaner, Cashier, and Outlet Staff
INSERT INTO employee_categories (name, description) VALUES
  ('Baker', 'Bakery production staff'),
  ('Driver', 'Delivery drivers'),
  ('Sales', 'Sales and customer service staff'),
  ('Admin', 'Administrative staff'),
  ('Quality', 'Quality control inspectors'),
  ('Packer', 'Packaging and packing staff'),
  ('Supervisor', 'Team supervisors'),
  ('Manager', 'Department managers'),
  ('Rider', 'Delivery riders (motorcycle/bicycle)'),
  ('Cleaner', 'Cleaning and sanitation staff'),
  ('Cashier', 'Point of sale cashiers'),
  ('Outlet Staff', 'Staff assigned to branch outlets')
ON CONFLICT (name) DO NOTHING;
