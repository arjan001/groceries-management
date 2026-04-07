-- =============================================
-- NON-INVENTORY ITEMS SUPPORT
-- =============================================
-- Adds cost tracking fields to POS and order items so custom
-- items (not in inventory) can be accounted for in reports.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'is_non_inventory') THEN
    ALTER TABLE order_items ADD COLUMN is_non_inventory BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'unit_cost') THEN
    ALTER TABLE order_items ADD COLUMN unit_cost NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'cost_total') THEN
    ALTER TABLE order_items ADD COLUMN cost_total NUMERIC DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pos_sale_items' AND column_name = 'is_non_inventory') THEN
    ALTER TABLE pos_sale_items ADD COLUMN is_non_inventory BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pos_sale_items' AND column_name = 'unit_cost') THEN
    ALTER TABLE pos_sale_items ADD COLUMN unit_cost NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pos_sale_items' AND column_name = 'cost_total') THEN
    ALTER TABLE pos_sale_items ADD COLUMN cost_total NUMERIC DEFAULT 0;
  END IF;
END $$;
