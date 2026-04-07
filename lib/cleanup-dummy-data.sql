-- =============================================
-- SNACKOH BAKERY - CLEAN SLATE: Remove All Dummy/Test Data
-- Run this in your Supabase SQL Editor to start fresh
-- WARNING: This will DELETE ALL existing data from report & transactional tables!
-- Schema, roles, permissions, users, employees, audit logs, and system config are preserved.
-- =============================================

BEGIN;

-- ─── 1. Child / dependent tables first (to avoid FK violations) ───

-- Order items & POS sale items
DELETE FROM order_items;
DELETE FROM pos_sale_items;

-- Debtor & Creditor transactions
DELETE FROM debtor_transactions;
DELETE FROM creditor_transactions;

-- Picking list items
DELETE FROM picking_list_items;

-- Purchase order items
DELETE FROM purchase_order_items;

-- Recipe ingredients
DELETE FROM recipe_ingredients;

-- NOTE: employee_certificates is PRESERVED (linked to employees)

-- Inventory transactions
DELETE FROM inventory_transactions;

-- Outlet-specific child tables
DELETE FROM outlet_return_items;
DELETE FROM outlet_inventory_transactions;
DELETE FROM outlet_requisition_items;
DELETE FROM outlet_transfer_items;

-- Credit invoice payments
DELETE FROM credit_invoice_payments;

-- Store requisition items
DELETE FROM store_requisition_items;

-- Asset logs
DELETE FROM asset_maintenance_log;
DELETE FROM asset_cost_log;
DELETE FROM asset_assignments;

-- ─── 2. Main transactional / report tables ───

-- Financial reports
DELETE FROM pl_reports;
DELETE FROM cost_entries;
DELETE FROM revenue_entries;
DELETE FROM ledger_entries;

-- Sales & Orders
DELETE FROM orders;
DELETE FROM pos_sales;
DELETE FROM mpesa_transactions;
DELETE FROM card_payments;

-- Deliveries
DELETE FROM deliveries;

-- Production
DELETE FROM production_runs;
DELETE FROM picking_lists;

-- Lot tracking
DELETE FROM lot_tracking;

-- Waste records
DELETE FROM waste_records;

-- Purchasing
DELETE FROM purchase_orders;

-- Debtors & Creditors
DELETE FROM debtors;
DELETE FROM creditors;

-- Assets
DELETE FROM assets;

-- Inventory items (seed data)
DELETE FROM inventory_items;

-- Inventory categories (seed data)
DELETE FROM inventory_categories;

-- Asset categories (seed data)
DELETE FROM asset_categories;

-- Pricing tiers (seed data)
DELETE FROM pricing_tiers;

-- Recipes (seed data)
DELETE FROM recipes;

-- Food info (seed data)
DELETE FROM food_info;

-- Customers (keep Walk-in Customer, delete the rest)
DELETE FROM customers WHERE name != 'Walk-in Customer';

-- NOTE: employees are PRESERVED (not deleted)

-- Outlet-specific tables
DELETE FROM outlet_returns;
DELETE FROM outlet_waste_records;
DELETE FROM outlet_inventory;
DELETE FROM outlet_requisitions;
DELETE FROM outlet_transfers;
DELETE FROM outlet_products;
DELETE FROM outlet_employees;
DELETE FROM outlet_settings;

-- Distribution
DELETE FROM distribution_records;
DELETE FROM distribution_agents;
DELETE FROM distributors;
DELETE FROM distributor_categories;

-- Rider damage reports
DELETE FROM rider_damage_reports;

-- Credit invoices & store requisitions
DELETE FROM credit_invoices;
DELETE FROM store_requisitions;

-- Employee productivity
DELETE FROM employee_productivity;
DELETE FROM employee_productivity_summary;

-- Stock requisitions
DELETE FROM stock_requisitions;

-- POS sessions
DELETE FROM pos_sessions;

-- Expenses
DELETE FROM expenses;

-- NOTE: audit_log is PRESERVED (history retained for compliance)

-- Newsletter subscribers
DELETE FROM newsletter_subscribers;

-- Offers
DELETE FROM offers;

-- ─── 3. Preserve system tables ───
-- The following are NOT deleted (system config & user data):
--   - roles (Administrator, Manager, Baker, Driver, Cashier)
--   - permissions (system permissions)
--   - role_permissions (role-permission mappings)
--   - users (auth users)
--   - employees (all employee records preserved)
--   - employee_categories (Baker, Driver, Sales, etc.)
--   - employee_certificates (linked to employees)
--   - audit_log (full audit history retained)
--   - business_settings (system configuration)
--   - mpesa_settings (API configuration)
--   - outlets (outlet definitions - kept for structure)
--   - settings_categories, settings_ingredients, settings_menu_items
--   - product_categories

COMMIT;

-- =============================================
-- VERIFICATION: Check tables are empty (transactional) or preserved
-- =============================================
SELECT 'pl_reports' AS table_name, COUNT(*) AS row_count FROM pl_reports
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'pos_sales', COUNT(*) FROM pos_sales
UNION ALL SELECT 'inventory_items', COUNT(*) FROM inventory_items
UNION ALL SELECT 'debtors', COUNT(*) FROM debtors
UNION ALL SELECT 'creditors', COUNT(*) FROM creditors
UNION ALL SELECT 'assets', COUNT(*) FROM assets
UNION ALL SELECT 'employees (preserved)', COUNT(*) FROM employees
UNION ALL SELECT 'waste_records', COUNT(*) FROM waste_records
UNION ALL SELECT 'ledger_entries', COUNT(*) FROM ledger_entries
UNION ALL SELECT 'deliveries', COUNT(*) FROM deliveries
UNION ALL SELECT 'recipes', COUNT(*) FROM recipes
UNION ALL SELECT 'pricing_tiers', COUNT(*) FROM pricing_tiers
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'audit_log (preserved)', COUNT(*) FROM audit_log
UNION ALL SELECT 'roles (preserved)', COUNT(*) FROM roles
UNION ALL SELECT 'permissions (preserved)', COUNT(*) FROM permissions
ORDER BY table_name;
