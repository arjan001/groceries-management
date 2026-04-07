-- =============================================
-- FIX: Employee Update Failure
-- "Update failed — no rows were changed. The employee record may be protected by database policies."
--
-- ROOT CAUSE:
-- Row Level Security (RLS) is enabled on the employees table, but there are
-- no policies granting UPDATE/INSERT/SELECT/DELETE access. When RLS is enabled
-- without any ALLOW policies, PostgreSQL silently blocks all operations and
-- returns 0 rows — causing the application to throw the error above.
--
-- The Supabase client uses the anon key, so all queries go through RLS.
--
-- This script provides TWO options:
--   OPTION A (Recommended for internal/admin apps): Disable RLS entirely
--   OPTION B (Recommended for multi-tenant apps):   Add proper RLS policies
--
-- Run the appropriate option in your Supabase SQL Editor.
-- =============================================


-- =============================================
-- OPTION A: DISABLE RLS ON EMPLOYEES TABLE
-- Use this if you do NOT need row-level restrictions
-- (e.g., only admins access employee data via the app)
-- =============================================

ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

-- Also drop any existing policies that may conflict
DROP POLICY IF EXISTS "Allow public read employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated read employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated insert employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated update employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated delete employees" ON employees;
DROP POLICY IF EXISTS "employees_select_policy" ON employees;
DROP POLICY IF EXISTS "employees_insert_policy" ON employees;
DROP POLICY IF EXISTS "employees_update_policy" ON employees;
DROP POLICY IF EXISTS "employees_delete_policy" ON employees;

-- Grant full access to authenticated and anon roles (Supabase default roles)
GRANT ALL ON employees TO authenticated;
GRANT ALL ON employees TO anon;
GRANT ALL ON employees TO service_role;


-- =============================================
-- OPTION B: KEEP RLS BUT ADD PROPER POLICIES
-- Uncomment the block below if you WANT RLS enabled
-- but need proper access policies.
-- Comment out OPTION A above if using this instead.
-- =============================================

/*
-- Enable RLS (idempotent)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start clean
DROP POLICY IF EXISTS "Allow public read employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated read employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated insert employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated update employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated delete employees" ON employees;
DROP POLICY IF EXISTS "employees_select_policy" ON employees;
DROP POLICY IF EXISTS "employees_insert_policy" ON employees;
DROP POLICY IF EXISTS "employees_update_policy" ON employees;
DROP POLICY IF EXISTS "employees_delete_policy" ON employees;

-- SELECT: Allow all authenticated users to read employees
CREATE POLICY "employees_select_policy" ON employees
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- INSERT: Allow authenticated users to create employees
CREATE POLICY "employees_insert_policy" ON employees
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- UPDATE: Allow authenticated users to update any employee
CREATE POLICY "employees_update_policy" ON employees
  FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- DELETE: Allow authenticated users to delete employees
CREATE POLICY "employees_delete_policy" ON employees
  FOR DELETE
  TO authenticated, anon
  USING (true);
*/


-- =============================================
-- ALSO FIX: Related tables that may have the same issue
-- =============================================

-- Employee categories table
ALTER TABLE employee_categories DISABLE ROW LEVEL SECURITY;
GRANT ALL ON employee_categories TO authenticated;
GRANT ALL ON employee_categories TO anon;
GRANT ALL ON employee_categories TO service_role;

-- Audit log table (used when saving employees)
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
GRANT ALL ON audit_log TO authenticated;
GRANT ALL ON audit_log TO anon;
GRANT ALL ON audit_log TO service_role;


-- =============================================
-- VERIFICATION: Run these queries after applying the fix
-- to confirm the issue is resolved
-- =============================================

-- 1. Check if RLS is disabled on employees table
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'employees';
-- Expected result: rowsecurity = false

-- 2. Check existing policies (should be empty if using Option A)
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'employees';
-- Expected result: no rows (Option A) or 4 policies (Option B)

-- 3. Test an update (replace with a real employee ID)
-- UPDATE employees SET status = status WHERE id = '<some-employee-uuid>' RETURNING id;
-- Expected result: should return 1 row
