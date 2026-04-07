-- =============================================
-- MIGRATION: Employee Productivity, Stock Requisitions,
-- POS Sessions & Reorder Level Enhancements
-- =============================================
-- This migration is idempotent: safe to run multiple times.
-- All CREATE TABLE uses IF NOT EXISTS, all ALTER TABLE uses
-- existence checks to avoid errors on re-run.
-- =============================================

-- =============================================
-- 1. EMPLOYEE PRODUCTIVITY
-- =============================================
-- Tracks individual KPI metrics for each employee.
-- Each row represents a single metric measurement on a given date.
-- metric_type values:
--   'batches_produced'      - number of production batches completed
--   'deliveries_completed'  - deliveries successfully finished
--   'deliveries_assigned'   - deliveries assigned to the employee
--   'pos_sales'             - point-of-sale transactions processed
--   'waste_reports'         - waste/spoilage reports filed
--   'system_logins'         - number of system logins recorded
--   'pos_facilitated'       - POS sessions facilitated
--   'general'               - catch-all for uncategorised metrics
-- Used by: app/admin/employees/page.tsx, app/admin/reports/page.tsx
-- =============================================
CREATE TABLE IF NOT EXISTS employee_productivity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL DEFAULT '',
  metric_type TEXT NOT NULL DEFAULT 'general',
  metric_value NUMERIC NOT NULL DEFAULT 0,
  target_value NUMERIC DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns on employee_productivity
CREATE INDEX IF NOT EXISTS idx_employee_productivity_employee
  ON employee_productivity(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_productivity_date
  ON employee_productivity(date);
CREATE INDEX IF NOT EXISTS idx_employee_productivity_metric_type
  ON employee_productivity(metric_type);
CREATE INDEX IF NOT EXISTS idx_employee_productivity_employee_date
  ON employee_productivity(employee_id, date);

-- =============================================
-- 2. EMPLOYEE PRODUCTIVITY SUMMARY
-- =============================================
-- Daily, weekly, or monthly rollup of employee productivity scores.
-- Aggregates individual metrics into a single summary row per
-- employee per period.  The kpi_percentage and rating fields
-- provide a quick performance snapshot.
-- rating values: 'Excellent', 'Good', 'Needs Improvement'
-- period_type values: 'daily', 'weekly', 'monthly'
-- Used by: app/admin/employees/page.tsx, app/admin/reports/page.tsx
-- =============================================
CREATE TABLE IF NOT EXISTS employee_productivity_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL DEFAULT '',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'daily',
  total_score NUMERIC DEFAULT 0,
  batches_produced INTEGER DEFAULT 0,
  deliveries_completed INTEGER DEFAULT 0,
  deliveries_assigned INTEGER DEFAULT 0,
  pos_sales_count INTEGER DEFAULT 0,
  waste_reports_logged INTEGER DEFAULT 0,
  system_logins INTEGER DEFAULT 0,
  kpi_percentage NUMERIC DEFAULT 0,
  rating TEXT DEFAULT 'Needs Improvement',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns on employee_productivity_summary
CREATE INDEX IF NOT EXISTS idx_employee_prod_summary_employee
  ON employee_productivity_summary(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_prod_summary_period_type
  ON employee_productivity_summary(period_type);
CREATE INDEX IF NOT EXISTS idx_employee_prod_summary_period_start
  ON employee_productivity_summary(period_start);
CREATE INDEX IF NOT EXISTS idx_employee_prod_summary_employee_period
  ON employee_productivity_summary(employee_id, period_start, period_end);

-- =============================================
-- 3. STOCK REQUISITIONS
-- =============================================
-- Stock reorder / production requests.  When inventory drops
-- below reorder levels, a requisition is created to trigger
-- a new production run or purchase.
-- priority values: 'Urgent', 'Normal', 'Low'
-- status values: 'Pending', 'Approved', 'In Production',
--                'Completed', 'Rejected'
-- Used by: app/admin/inventory/page.tsx, app/admin/production/page.tsx
-- =============================================
CREATE TABLE IF NOT EXISTS stock_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  product_id TEXT,
  recipe_id TEXT,
  recipe_code TEXT,
  quantity_requested NUMERIC NOT NULL DEFAULT 0,
  quantity_approved NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'pieces',
  priority TEXT NOT NULL DEFAULT 'Normal',
  status TEXT NOT NULL DEFAULT 'Pending',
  requested_by TEXT DEFAULT '',
  approved_by TEXT DEFAULT '',
  rejection_reason TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  linked_production_run_id UUID,
  estimated_production_time INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns on stock_requisitions
CREATE INDEX IF NOT EXISTS idx_stock_requisitions_status
  ON stock_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_stock_requisitions_priority
  ON stock_requisitions(priority);
CREATE INDEX IF NOT EXISTS idx_stock_requisitions_created_at
  ON stock_requisitions(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_requisitions_product_name
  ON stock_requisitions(product_name);

-- =============================================
-- 4. POS SESSIONS
-- =============================================
-- Tracks POS (Point-of-Sale) cashier sessions for session
-- persistence.  Each session records opening / closing balances,
-- sales totals, and shift notes so that sessions survive page
-- reloads and browser restarts.
-- status values: 'active', 'closed'
-- Used by: app/admin/pos/page.tsx
-- =============================================
CREATE TABLE IF NOT EXISTS pos_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_name TEXT NOT NULL DEFAULT 'Cashier',
  cashier_email TEXT DEFAULT '',
  opening_balance NUMERIC DEFAULT 0,
  closing_balance NUMERIC DEFAULT 0,
  expected_closing NUMERIC DEFAULT 0,
  total_sales_count INTEGER DEFAULT 0,
  total_sales_amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  shift_notes TEXT DEFAULT '',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns on pos_sessions
CREATE INDEX IF NOT EXISTS idx_pos_sessions_status
  ON pos_sessions(status);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_cashier_email
  ON pos_sessions(cashier_email);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_started_at
  ON pos_sessions(started_at);

-- =============================================
-- 5. ALTER TABLE: Add reorder_level to pricing_tiers
-- =============================================
-- pricing_tiers tracks product pricing but does not yet have a
-- reorder_level column.  Adding it here allows the system to
-- trigger stock requisitions based on pricing tier thresholds.
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pricing_tiers' AND column_name = 'reorder_level'
  ) THEN
    ALTER TABLE pricing_tiers ADD COLUMN reorder_level NUMERIC DEFAULT 0;
  END IF;
END $$;

-- =============================================
-- 6. ALTER TABLE: Ensure reorder_level exists on inventory_items
-- =============================================
-- inventory_items should already have reorder_level from the base
-- schema, but this guard ensures it exists even if the original
-- column was dropped or the schema was partially applied.
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'reorder_level'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN reorder_level NUMERIC DEFAULT 0;
  END IF;
END $$;

-- =============================================
-- Migration complete.
-- =============================================
