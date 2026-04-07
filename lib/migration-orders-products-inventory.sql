-- =============================================
-- MIGRATION: Orders, Products & Inventory Enhancements
-- Run this in your Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. ORDERS TABLE - Add missing columns
-- =============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Regular';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment TEXT DEFAULT 'Delivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- =============================================
-- 2. FOOD_INFO TABLE - Add inventory & recipe fields
-- =============================================
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS recipe_name TEXT;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS current_stock DECIMAL DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS stock_unit TEXT DEFAULT 'pieces';
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS moq INTEGER DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS reorder_level DECIMAL DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS max_stock DECIMAL DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS fifo_enabled BOOLEAN DEFAULT true;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS last_restocked DATE;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS supplier TEXT;

CREATE INDEX IF NOT EXISTS idx_food_info_recipe ON food_info(recipe_id);

-- =============================================
-- 3. EMPLOYEES TABLE - Add missing columns for system access
-- =============================================
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_id_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS system_access BOOLEAN DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS login_email TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS login_role TEXT DEFAULT 'Viewer';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS certificates JSONB DEFAULT '[]';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]';

-- =============================================
-- 4. RECIPE_INGREDIENTS - Add sourcing_note column
-- =============================================
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS sourcing_note TEXT;
