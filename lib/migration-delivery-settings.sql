-- =============================================
-- MIGRATION: Delivery Settings
-- Run this in your Supabase SQL Editor
-- Adds delivery configuration to business_settings
-- =============================================

-- =============================================
-- 1. INSERT DELIVERY SETTINGS INTO BUSINESS_SETTINGS
-- Controls minimum order for delivery, delivery fee, free delivery threshold
-- Admin can update via Settings > Delivery tab
-- =============================================
INSERT INTO business_settings (key, value) VALUES
  ('delivery', '{
    "deliveryEnabled": true,
    "minimumOrderForDelivery": 500,
    "deliveryFee": 200,
    "freeDeliveryThreshold": 2000,
    "estimatedDeliveryTime": "30-60 mins",
    "deliveryRadius": "10 km",
    "deliveryNotes": ""
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- 2. ADD DELIVERY FIELDS TO FOOD_INFO TABLE (Main Bakery Products)
-- These fields support dynamic website product display from inventory
-- =============================================
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '';
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS retail_price DECIMAL DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS selling_price DECIMAL DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS cost_price DECIMAL DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS current_stock DECIMAL DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS stock_unit TEXT DEFAULT 'pieces';
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS moq INTEGER DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS reorder_level DECIMAL DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS max_stock DECIMAL DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS fifo_enabled BOOLEAN DEFAULT true;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS batch_number TEXT DEFAULT '';
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS last_restocked DATE;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS supplier TEXT DEFAULT '';
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS recipe_id UUID;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS recipe_name TEXT DEFAULT '';

-- Index for quick lookups on food_info for website display
CREATE INDEX IF NOT EXISTS idx_food_info_current_stock ON food_info(current_stock);
CREATE INDEX IF NOT EXISTS idx_food_info_category ON food_info(category);

-- =============================================
-- 3. ADD RECIPE_NAME TO PRODUCTION_RUNS TABLE
-- Stores the recipe name alongside recipe_code for better display
-- =============================================
ALTER TABLE production_runs ADD COLUMN IF NOT EXISTS recipe_name TEXT DEFAULT '';
ALTER TABLE production_runs ADD COLUMN IF NOT EXISTS recipe_id UUID;

-- =============================================
-- 3. USAGE NOTES
-- =============================================
-- Delivery Settings (in admin Settings > Delivery tab):
--   minimumOrderForDelivery: Orders below this amount (default 500 KES)
--     will only be available for pickup, NOT delivery.
--   deliveryFee: The standard delivery charge (default 200 KES).
--   freeDeliveryThreshold: Orders above this amount (default 2000 KES)
--     get free delivery (no delivery fee charged).
--   deliveryEnabled: Master toggle to enable/disable delivery entirely.
--
-- Website Product Display:
--   The frontend website now dynamically loads products from the food_info table.
--   Only items from the main bakery's food_info catalog are displayed.
--   If food_info is empty, it falls back to the static product list.
--   Stock levels (current_stock) determine in-stock status on the website.
