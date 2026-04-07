-- =============================================
-- MIGRATION: Business Settings (Dynamic Configuration)
-- Run this in your Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. BUSINESS SETTINGS TABLE
-- Stores all system settings as key-value pairs (JSONB)
-- Keys: general, receipt, paymentDetails, security, backup
-- This replaces localStorage-only storage for settings
-- =============================================
CREATE TABLE IF NOT EXISTS business_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_settings_key ON business_settings(key);

-- =============================================
-- 2. SEED DEFAULT SETTINGS
-- These are the initial defaults; admin can update via Settings page
-- =============================================
INSERT INTO business_settings (key, value) VALUES
  ('general', '{
    "businessName": "SNACKOH BITES",
    "tagline": "Quality Baked Goods",
    "phone": "+254 700 000 000",
    "email": "info@snackoh.com",
    "shopNumber": "",
    "address": "Nairobi, Kenya",
    "currency": "KES",
    "taxRate": 16,
    "timezone": "Africa/Nairobi",
    "language": "en",
    "logoUrl": ""
  }'::jsonb),
  ('receipt', '{
    "showLogo": true,
    "headerText": "SNACKOH BITES",
    "subHeaderText": "Quality Baked Goods",
    "footerText": "Thank you for choosing Snackoh!",
    "showTax": true,
    "showCashier": true,
    "showCustomer": true,
    "showPaymentDetails": true,
    "disclaimer": "Goods once sold are not returnable",
    "paperWidth": "80mm",
    "autoPrint": false,
    "softwareProvidedBy": ""
  }'::jsonb),
  ('paymentDetails', '{
    "mpesaType": "paybill",
    "paybillNumber": "",
    "accountNumber": "",
    "tillNumber": "",
    "mpesaName": "SNACKOH BITES",
    "bankName": "",
    "bankAccount": "",
    "bankBranch": "",
    "showOnReceipt": true
  }'::jsonb),
  ('security', '{
    "requirePosPin": true,
    "pinLength": 4,
    "sessionTimeout": 30,
    "maxLoginAttempts": 5,
    "enforceStrongPasswords": false,
    "twoFactorAuth": false,
    "auditLogging": true,
    "ipWhitelist": ""
  }'::jsonb),
  ('backup', '{
    "autoBackup": true,
    "backupFrequency": "daily",
    "backupTime": "02:00",
    "retentionDays": 30,
    "lastBackup": "Never",
    "backupLocation": "supabase"
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- 3. EMPLOYEE CATEGORIES TABLE (if not already created)
-- Dynamic employee categories management
-- =============================================
CREATE TABLE IF NOT EXISTS employee_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default categories
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
  ('Cleaner', 'Cleaning and sanitation staff')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 4. ENSURE LOGOS STORAGE BUCKET EXISTS
-- For company logo uploads
-- =============================================
-- Note: Run this in your Supabase Dashboard > Storage
-- Or use the Supabase Management API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true)
-- ON CONFLICT (id) DO NOTHING;
