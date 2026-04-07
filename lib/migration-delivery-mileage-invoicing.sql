-- =============================================
-- MIGRATION: Delivery Mileage/Distance, Credit Invoices,
-- Store Requisitions, Debtors/Creditors Enhancements
-- =============================================
-- This migration is idempotent: safe to run multiple times.
-- =============================================

-- =============================================
-- 1. DELIVERY: Add departure location, distance, mileage fields
-- =============================================
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS departure_location TEXT DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS distance_km DECIMAL DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS trip_start_mileage DECIMAL DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS trip_end_mileage DECIMAL DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS customer_phone TEXT DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS customer_location TEXT DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS customer_address TEXT DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS customer_gps_lat DECIMAL DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS customer_gps_lng DECIMAL DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS driver_name TEXT DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS vehicle_id UUID;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS vehicle_name TEXT DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS time_slot TEXT DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS special_instructions TEXT DEFAULT '';

-- =============================================
-- 2. CREDIT SALES INVOICES
-- =============================================
CREATE TABLE IF NOT EXISTS credit_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT DEFAULT '',
  debtor_id UUID REFERENCES debtors(id) ON DELETE SET NULL,
  sale_id UUID,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  items JSONB DEFAULT '[]',
  subtotal DECIMAL DEFAULT 0,
  tax DECIMAL DEFAULT 0,
  total_amount DECIMAL NOT NULL DEFAULT 0,
  amount_paid DECIMAL DEFAULT 0,
  balance DECIMAL DEFAULT 0,
  payment_terms_days INTEGER DEFAULT 30,
  due_date DATE,
  issue_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'Unpaid',
  notes TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES credit_invoices(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL,
  payment_method TEXT DEFAULT 'Cash',
  reference TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  received_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_invoices_status ON credit_invoices(status);
CREATE INDEX IF NOT EXISTS idx_credit_invoices_customer ON credit_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_invoices_due_date ON credit_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_credit_invoices_debtor ON credit_invoices(debtor_id);

-- =============================================
-- 3. STORE REQUISITIONS (Baker -> Store)
-- =============================================
CREATE TABLE IF NOT EXISTS store_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_number TEXT UNIQUE,
  requested_by TEXT NOT NULL DEFAULT '',
  requested_by_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  department TEXT DEFAULT 'Production',
  status TEXT DEFAULT 'Pending',
  priority TEXT DEFAULT 'Normal',
  approved_by TEXT DEFAULT '',
  approved_at TIMESTAMPTZ,
  issued_by TEXT DEFAULT '',
  issued_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_requisition_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES store_requisitions(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity_requested DECIMAL NOT NULL DEFAULT 0,
  quantity_approved DECIMAL DEFAULT 0,
  quantity_issued DECIMAL DEFAULT 0,
  unit TEXT DEFAULT 'kg',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_requisitions_status ON store_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_store_requisitions_requested_by ON store_requisitions(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_store_req_items_requisition ON store_requisition_items(requisition_id);

-- =============================================
-- 4. DEBTORS: Add debt_opened_date and credit_limit_days
-- =============================================
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS debt_opened_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS credit_limit_days INTEGER DEFAULT 30;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS flag_reason TEXT DEFAULT '';

-- =============================================
-- 5. CREDITORS: Add credit_opened_date and max_credit_days
-- =============================================
ALTER TABLE creditors ADD COLUMN IF NOT EXISTS credit_opened_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE creditors ADD COLUMN IF NOT EXISTS max_credit_days INTEGER DEFAULT 30;
ALTER TABLE creditors ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false;
ALTER TABLE creditors ADD COLUMN IF NOT EXISTS flag_reason TEXT DEFAULT '';

-- =============================================
-- 6. INVENTORY: Ensure reorder_qty exists for stock reorder functionality
-- =============================================
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS reorder_qty DECIMAL DEFAULT 0;

-- =============================================
-- Migration complete.
-- =============================================
