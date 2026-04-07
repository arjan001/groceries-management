-- =============================================
-- MIGRATION: Fix Orders & M-Pesa columns
-- Run this in your Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. ORDERS TABLE - Add missing columns for source, fulfillment, rejection
-- These columns are REQUIRED for the admin dashboard to filter orders
-- and for the checkout page to save orders correctly.
-- =============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Regular';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment TEXT DEFAULT 'Delivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- =============================================
-- 2. MPESA_TRANSACTIONS TABLE - Ensure columns match what the code expects
-- The callback handler writes to mpesa_receipt, the STK push writes account_reference
-- =============================================
ALTER TABLE mpesa_transactions ADD COLUMN IF NOT EXISTS account_reference TEXT;
ALTER TABLE mpesa_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for faster checkout request lookups
CREATE INDEX IF NOT EXISTS idx_mpesa_checkout ON mpesa_transactions(checkout_request_id);

-- =============================================
-- 3. Enable Realtime for orders table (required for notifications)
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
