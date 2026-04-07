-- =============================================
-- MIGRATION: M-Pesa API Settings (Database Backup)
-- Run this in your Supabase SQL Editor
-- Primary source: Environment variables (.env)
-- Database serves as backup storage
-- =============================================

-- =============================================
-- 1. M-PESA SETTINGS TABLE
-- Stores M-Pesa API credentials as backup
-- The application reads from env vars first,
-- falls back to this table if env vars are empty
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
-- 2. SEED DEFAULT SETTINGS STRUCTURE
-- Values are empty — admin fills them via dashboard
-- =============================================
INSERT INTO mpesa_settings (setting_key, setting_value, description, is_sensitive) VALUES
  ('mpesa_consumer_key', '', 'M-Pesa API Consumer Key (from Daraja portal)', true),
  ('mpesa_consumer_secret', '', 'M-Pesa API Consumer Secret (from Daraja portal)', true),
  ('mpesa_shortcode', '174379', 'M-Pesa Business Shortcode', false),
  ('mpesa_passkey', '', 'M-Pesa STK Push Passkey', true),
  ('mpesa_callback_url', '', 'M-Pesa payment callback URL', false),
  ('mpesa_env', 'sandbox', 'Environment: sandbox or production', false),
  ('mpesa_b2c_shortcode', '', 'M-Pesa B2C Shortcode', false),
  ('mpesa_b2c_initiator_name', '', 'M-Pesa B2C Initiator Name', false),
  ('mpesa_b2c_security_credential', '', 'M-Pesa B2C Security Credential', true),
  ('mpesa_b2c_consumer_key', '', 'M-Pesa B2C Consumer Key', true),
  ('mpesa_b2c_consumer_secret', '', 'M-Pesa B2C Consumer Secret', true),
  ('mpesa_b2c_result_url', '', 'M-Pesa B2C Result URL', false),
  ('mpesa_b2c_timeout_url', '', 'M-Pesa B2C Timeout URL', false)
ON CONFLICT (setting_key) DO NOTHING;

-- =============================================
-- 3. HELPER: Function to update setting with timestamp
-- =============================================
CREATE OR REPLACE FUNCTION update_mpesa_setting(p_key TEXT, p_value TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO mpesa_settings (setting_key, setting_value, updated_at)
  VALUES (p_key, p_value, NOW())
  ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = p_value, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
