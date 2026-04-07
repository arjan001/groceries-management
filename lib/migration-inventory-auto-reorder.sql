-- =============================================
-- Migration: Add auto_reorder and distributor_id columns to inventory_items
-- Fixes: "Could not find the 'auto_reorder' column of 'inventory_items' in the schema cache"
-- =============================================

-- Add auto_reorder boolean column (default false)
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS auto_reorder BOOLEAN DEFAULT false;

-- Add distributor_id column to link inventory items to distributors
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS distributor_id UUID;

-- Add reorder_qty if it doesn't exist (safety check, may already exist from prior migration)
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS reorder_qty DECIMAL DEFAULT 0;
