-- =============================================
-- MIGRATION: B2C Transactions & C2B Register URL
-- Run this in your Supabase SQL Editor
-- Adds B2C (Business-to-Customer) disbursement tracking
-- and C2B validation/confirmation URL registration
-- =============================================

-- =============================================
-- 1. B2C TRANSACTIONS TABLE
-- Tracks all B2C disbursement payments
-- =============================================
CREATE TABLE IF NOT EXISTS b2c_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id TEXT,
  originator_conversation_id TEXT,
  transaction_id TEXT,
  phone TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  command_id TEXT NOT NULL DEFAULT 'BusinessPayment',
  remarks TEXT,
  occasion TEXT,
  mpesa_receipt TEXT,
  result_code INTEGER,
  result_desc TEXT,
  receiver_name TEXT,
  completed_at TEXT,
  utility_balance DECIMAL(12,2),
  working_balance DECIMAL(12,2),
  status TEXT NOT NULL DEFAULT 'pending',
  initiated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b2c_txn_conversation ON b2c_transactions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_b2c_txn_originator ON b2c_transactions(originator_conversation_id);
CREATE INDEX IF NOT EXISTS idx_b2c_txn_phone ON b2c_transactions(phone);
CREATE INDEX IF NOT EXISTS idx_b2c_txn_status ON b2c_transactions(status);
CREATE INDEX IF NOT EXISTS idx_b2c_txn_created ON b2c_transactions(created_at DESC);

-- =============================================
-- 2. C2B REGISTERED URLS TABLE
-- Tracks C2B validation/confirmation URL registrations
-- =============================================
CREATE TABLE IF NOT EXISTS c2b_registered_urls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shortcode TEXT NOT NULL,
  response_type TEXT NOT NULL DEFAULT 'Completed',
  confirmation_url TEXT NOT NULL,
  validation_url TEXT NOT NULL,
  registration_status TEXT DEFAULT 'pending',
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_c2b_urls_shortcode ON c2b_registered_urls(shortcode);

-- =============================================
-- 3. C2B PAYMENTS TABLE
-- Tracks C2B payments received via confirmation URL
-- =============================================
CREATE TABLE IF NOT EXISTS c2b_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transaction_type TEXT,
  transaction_id TEXT UNIQUE,
  transaction_time TEXT,
  amount DECIMAL(12,2) NOT NULL,
  business_shortcode TEXT,
  bill_ref_number TEXT,
  invoice_number TEXT,
  org_account_balance DECIMAL(12,2),
  third_party_trans_id TEXT,
  phone TEXT,
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT,
  is_validated BOOLEAN DEFAULT true,
  validation_result TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_c2b_payments_txn_id ON c2b_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_c2b_payments_phone ON c2b_payments(phone);
CREATE INDEX IF NOT EXISTS idx_c2b_payments_ref ON c2b_payments(bill_ref_number);
CREATE INDEX IF NOT EXISTS idx_c2b_payments_created ON c2b_payments(created_at DESC);

-- =============================================
-- 4. ADD FAMILY BANK SETTINGS TO MPESA_SETTINGS
-- =============================================
INSERT INTO mpesa_settings (setting_key, setting_value, description, is_sensitive) VALUES
  ('mpesa_c2b_confirmation_url', '', 'C2B Confirmation URL for receiving payment notifications', false),
  ('mpesa_c2b_validation_url', '', 'C2B Validation URL for validating payments before processing', false),
  ('mpesa_c2b_response_type', 'Completed', 'C2B response type: Completed or Cancelled', false),
  ('family_bank_paybill', '', 'Family Bank Paybill Number', false),
  ('family_bank_account', '', 'Family Bank Account Number', false)
ON CONFLICT (setting_key) DO NOTHING;

-- =============================================
-- 5. ENABLE ROW LEVEL SECURITY
-- =============================================
ALTER TABLE b2c_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE c2b_registered_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE c2b_payments ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage b2c_transactions" ON b2c_transactions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage c2b_registered_urls" ON c2b_registered_urls
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage c2b_payments" ON c2b_payments
  FOR ALL USING (true) WITH CHECK (true);
