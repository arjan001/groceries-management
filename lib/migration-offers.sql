-- =============================================
-- OFFERS: TABLE + BASIC ACCESS POLICIES
-- Run in Supabase SQL Editor
-- =============================================

-- Table (safe to re-run)
CREATE TABLE IF NOT EXISTS offers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT DEFAULT '/shop',
  badge_text TEXT DEFAULT 'Limited Time',
  discount_text TEXT,
  product_id TEXT,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offers_active ON offers(is_active, start_date, end_date);

-- If RLS is enabled in the project, allow public read of active offers
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'offers' AND policyname = 'Public read active offers'
  ) THEN
    CREATE POLICY "Public read active offers"
      ON offers
      FOR SELECT
      USING (is_active = true AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'offers' AND policyname = 'Authenticated manage offers'
  ) THEN
    CREATE POLICY "Authenticated manage offers"
      ON offers
      FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;
