-- =============================================
-- MIGRATION: Postal Address Fields & New Employee Categories
-- Run this on existing databases to split address into postal_address, postal_code, town
-- and add 'Accounts and Finance' and 'Intern' employee categories.
-- =============================================

-- ── ADD POSTAL ADDRESS COLUMNS TO EMPLOYEES TABLE ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'postal_address') THEN
    ALTER TABLE employees ADD COLUMN postal_address TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'postal_code') THEN
    ALTER TABLE employees ADD COLUMN postal_code TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'town') THEN
    ALTER TABLE employees ADD COLUMN town TEXT;
  END IF;
END $$;

-- ── MIGRATE EXISTING ADDRESS DATA TO POSTAL_ADDRESS ──
-- Copy old address values into postal_address for existing records
UPDATE employees
SET postal_address = address
WHERE address IS NOT NULL AND address != '' AND (postal_address IS NULL OR postal_address = '');

-- ── ADD NEW EMPLOYEE CATEGORIES ──
INSERT INTO employee_categories (name) VALUES
  ('Accounts and Finance'),
  ('Intern')
ON CONFLICT (name) DO NOTHING;

-- ── ADD EMAIL SETTINGS TABLE (for Resend email configuration) ──
DO $$ BEGIN
  INSERT INTO business_settings (key, value) VALUES
    ('emailSettings', '{"enabled": false, "fromEmail": "", "fromName": "", "resendApiKey": ""}')
  ON CONFLICT (key) DO NOTHING;
END $$;
