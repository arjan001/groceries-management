-- =============================================
-- MIGRATION: Smart Auto-Updating Changelog
-- Run this in your Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. CHANGELOG VERSIONS TABLE
-- Stores version releases with summaries
-- =============================================
CREATE TABLE IF NOT EXISTS changelog_versions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  release_date TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_changelog_versions_version ON changelog_versions(version);
CREATE INDEX IF NOT EXISTS idx_changelog_versions_created ON changelog_versions(created_at DESC);

-- =============================================
-- 2. CHANGELOG ENTRIES TABLE
-- Stores individual change items linked to a version
-- =============================================
CREATE TABLE IF NOT EXISTS changelog_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES changelog_versions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  details JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'in-progress', 'pending')),
  category TEXT NOT NULL DEFAULT 'feature' CHECK (category IN ('security', 'feature', 'integration', 'fix', 'performance', 'infrastructure')),
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_changelog_entries_version ON changelog_entries(version_id);
CREATE INDEX IF NOT EXISTS idx_changelog_entries_category ON changelog_entries(category);
CREATE INDEX IF NOT EXISTS idx_changelog_entries_created ON changelog_entries(created_at DESC);

-- =============================================
-- 3. SYSTEM HEALTH TABLE
-- Stores current system health status items
-- =============================================
CREATE TABLE IF NOT EXISTS system_health (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'pending', 'degraded')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. SEED EXISTING CHANGELOG DATA
-- Migrates hardcoded changelog into the database
-- =============================================

-- Version v2.0.4
INSERT INTO changelog_versions (version, release_date, summary) VALUES
  ('v2.0.4', 'March 10, 2026', 'CSV catalog upload, database document organization, and sidebar navigation improvements.'),
  ('v2.0.3', 'March 9, 2026', 'Restored M-Pesa and card payment options on the public checkout page.'),
  ('v2.0.2', 'March 6, 2026', 'User activation controls, maintenance mode with SQL integration, and system stability improvements.'),
  ('v2.0.1', 'March 4–5, 2026', 'Major security review, Family Bank C2B/B2C integration, audit log hardening, delivery automation, and financial calculation accuracy.')
ON CONFLICT (version) DO NOTHING;

-- Entries for v2.0.4
INSERT INTO changelog_entries (version_id, title, description, details, status, category, date)
SELECT v.id,
  'CSV Catalog Bulk Upload',
  'New module allowing bulk import of products from CSV catalogue files directly into the database. Includes template download, column mapping, validation, and batch insert.',
  '["Upload CSV files with product data (name, category, price, description, etc.)", "Automatic column detection and mapping", "Data validation before import with error reporting", "Downloadable CSV template for standardized uploads", "SQL migration for catalog data structure"]'::jsonb,
  'completed', 'feature', '2026-03-10'
FROM changelog_versions v WHERE v.version = 'v2.0.4'
ON CONFLICT DO NOTHING;

INSERT INTO changelog_entries (version_id, title, description, details, status, category, date)
SELECT v.id,
  'Sidebar Navigation — Catalog Upload Link',
  'Added "Catalog Upload" navigation item under the Production section with FileUp icon for easy access.',
  '[]'::jsonb,
  'completed', 'feature', '2026-03-10'
FROM changelog_versions v WHERE v.version = 'v2.0.4'
ON CONFLICT DO NOTHING;

-- Entries for v2.0.3
INSERT INTO changelog_entries (version_id, title, description, details, status, category, date)
SELECT v.id,
  'Checkout Payment Methods Restored',
  'Re-enabled M-Pesa STK Push and card payment options on the e-commerce checkout page. Customers can now complete payments via mobile money or card during checkout.',
  '["M-Pesa STK Push payment flow restored", "Card payment option re-enabled", "Payment method selection UI updated"]'::jsonb,
  'completed', 'fix', '2026-03-09'
FROM changelog_versions v WHERE v.version = 'v2.0.3'
ON CONFLICT DO NOTHING;

-- Entries for v2.0.2
INSERT INTO changelog_entries (version_id, title, description, details, status, category, date)
SELECT v.id,
  'User Activation Toggle',
  'Administrators can now activate or deactivate user accounts directly from the admin panel. Deactivated users are immediately locked out of the system.',
  '["Toggle switch on employee/user management page", "Immediate session invalidation on deactivation", "SQL-backed activation state", "Audit log entry on activation changes"]'::jsonb,
  'completed', 'feature', '2026-03-06'
FROM changelog_versions v WHERE v.version = 'v2.0.2'
ON CONFLICT DO NOTHING;

INSERT INTO changelog_entries (version_id, title, description, details, status, category, date)
SELECT v.id,
  'Maintenance Mode',
  'System-wide maintenance mode that displays a branded maintenance screen to all non-admin users. Admins can bypass the screen to continue working.',
  '["One-click enable/disable from admin settings", "Custom maintenance message support", "Admin bypass with impersonation banner", "SQL-backed toggle persisted across sessions"]'::jsonb,
  'completed', 'feature', '2026-03-06'
FROM changelog_versions v WHERE v.version = 'v2.0.2'
ON CONFLICT DO NOTHING;

-- Entries for v2.0.1
INSERT INTO changelog_entries (version_id, title, description, details, status, category, date)
SELECT v.id,
  'API Security Review — Frontend Key Exposure Fix',
  'Comprehensive security audit across all API routes to prevent sensitive keys and credentials from being exposed to the frontend. All API keys moved to server-side environment variables with proper access controls.',
  '["Audited 10+ API routes (auth, payments, AI, maps, settings)", "Removed all hardcoded API keys from client-side code", "Moved secrets to server-side environment variables", "Updated .gitignore to exclude sensitive configuration files", "Implemented server-side proxy patterns for external API calls", "M-Pesa credentials secured behind API routes", "ChatGPT/AI API keys isolated to serverless functions", "Google Maps API key restricted to server-side distance calculations"]'::jsonb,
  'completed', 'security', '2026-03-05'
FROM changelog_versions v WHERE v.version = 'v2.0.1'
ON CONFLICT DO NOTHING;

INSERT INTO changelog_entries (version_id, title, description, details, status, category, date)
SELECT v.id,
  'Family Bank C2B & B2C Integration',
  'Full integration with Family Bank for Customer-to-Business (C2B) and Business-to-Customer (B2C) payment services. The bank API integration is complete and tested. Awaiting production credentials from the bank to go live.',
  '["C2B Registration endpoint with validation and confirmation callbacks", "B2C Payment endpoint with result and timeout callbacks", "SQL migration for B2C/C2B transaction tracking tables", "Admin settings page updated — M-Pesa tab replaced with Family Bank tab", "Environment variables configured (.env.local.example updated)", "⚠️ PENDING: Production API credentials from Family Bank", "→ Once received, add credentials in Admin → Settings → Family Bank tab", "→ Register C2B URLs with the bank to start receiving payments"]'::jsonb,
  'in-progress', 'integration', '2026-03-04'
FROM changelog_versions v WHERE v.version = 'v2.0.1'
ON CONFLICT DO NOTHING;

INSERT INTO changelog_entries (version_id, title, description, details, status, category, date)
SELECT v.id,
  'Audit Logs — Super Admin Protection',
  'Main super admin account is now hidden from the employee list and audit log views to protect the root account from exposure. Test coverage added.',
  '["Super admin filtered from employee listing queries", "Super admin actions hidden from audit log UI", "Unit tests added for audit logger filtering", "Maintains full logging in database for compliance"]'::jsonb,
  'completed', 'security', '2026-03-04'
FROM changelog_versions v WHERE v.version = 'v2.0.1'
ON CONFLICT DO NOTHING;

INSERT INTO changelog_entries (version_id, title, description, details, status, category, date)
SELECT v.id,
  'Reports & Ledger — Zero Margin of Error',
  'Financial calculations across the Reports & Ledger module verified and hardened to ensure zero margin of error in totals, balances, and P&L statements.',
  '["Decimal precision enforced on all monetary calculations", "Rounding consistency applied across all report types", "Cross-verified totals between individual entries and summary reports"]'::jsonb,
  'completed', 'fix', '2026-03-04'
FROM changelog_versions v WHERE v.version = 'v2.0.1'
ON CONFLICT DO NOTHING;

INSERT INTO changelog_entries (version_id, title, description, details, status, category, date)
SELECT v.id,
  'Delivery — Auto Rider Assignment',
  'Automatic assignment of the closest available delivery rider based on real-time GPS location. Integrates with the map view for outlet-based deliveries.',
  '["Proximity-based rider matching algorithm", "Real-time availability checking", "Map integration showing rider positions", "Outlet-to-rider distance optimization"]'::jsonb,
  'completed', 'feature', '2026-03-04'
FROM changelog_versions v WHERE v.version = 'v2.0.1'
ON CONFLICT DO NOTHING;

INSERT INTO changelog_entries (version_id, title, description, details, status, category, date)
SELECT v.id,
  'Inventory & Purchase Orders — Auto-Generation',
  'Enhanced inventory module with auto-selection of low-stock items and automatic generation of purchase orders based on reorder levels.',
  '["Auto-detect items below reorder threshold", "One-click purchase order generation", "Supplier auto-selection based on pricing history", "Quantity suggestions based on consumption patterns"]'::jsonb,
  'completed', 'feature', '2026-03-04'
FROM changelog_versions v WHERE v.version = 'v2.0.1'
ON CONFLICT DO NOTHING;

INSERT INTO changelog_entries (version_id, title, description, details, status, category, date)
SELECT v.id,
  'AI Provider Switch — ChatGPT Integration',
  'Switched AI provider from Gemini to Free ChatGPT for product descriptions, recipe suggestions, and customer support automation.',
  '[]'::jsonb,
  'completed', 'infrastructure', '2026-03-04'
FROM changelog_versions v WHERE v.version = 'v2.0.1'
ON CONFLICT DO NOTHING;

INSERT INTO changelog_entries (version_id, title, description, details, status, category, date)
SELECT v.id,
  'Build Process & Cache Optimization',
  'Improved build pipeline with dependency caching, repository preparation, and optimized installation. Automated cache clearing on deployments.',
  '["Build cache configured for faster deployments", "Dependency tree cached between builds", "Automated stale cache clearing on system", "Repository preparation scripts optimized"]'::jsonb,
  'completed', 'performance', '2026-03-04'
FROM changelog_versions v WHERE v.version = 'v2.0.1'
ON CONFLICT DO NOTHING;

INSERT INTO changelog_entries (version_id, title, description, details, status, category, date)
SELECT v.id,
  'SQL Fix — Business Settings Table',
  'Fixed SQL query error where "category" column was incorrectly referenced in the "business_settings" table.',
  '[]'::jsonb,
  'completed', 'fix', '2026-03-04'
FROM changelog_versions v WHERE v.version = 'v2.0.1'
ON CONFLICT DO NOTHING;

-- =============================================
-- 5. SEED SYSTEM HEALTH DATA
-- =============================================
INSERT INTO system_health (label, value, status) VALUES
  ('Test Suite', '278 Tests — 100% Pass Rate', 'healthy'),
  ('Build Cache', 'Automated clearing on deploy', 'healthy'),
  ('API Security', 'All keys server-side only', 'healthy'),
  ('Audit Logging', 'Active — all actions tracked', 'healthy'),
  ('Backup System', 'Database backup API available', 'healthy'),
  ('Family Bank C2B', 'Awaiting bank credentials', 'pending'),
  ('Family Bank B2C', 'Awaiting bank credentials', 'pending'),
  ('M-Pesa STK Push', 'Operational on checkout', 'healthy')
ON CONFLICT (label) DO UPDATE SET
  value = EXCLUDED.value,
  status = EXCLUDED.status,
  updated_at = NOW();
