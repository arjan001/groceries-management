-- =============================================
-- MIGRATION: Newsletter Subscribers, Navbar Ads & Ad Storage
-- Run this in your Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. NEWSLETTER SUBSCRIBERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'footer',        -- 'modal', 'footer', 'admin', etc.
  discount_code TEXT,                   -- e.g. WELCOME15
  is_active BOOLEAN DEFAULT true,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_active ON newsletter_subscribers(is_active);

-- RLS for newsletter subscribers
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'newsletter_subscribers' AND policyname = 'Public insert newsletter'
  ) THEN
    CREATE POLICY "Public insert newsletter"
      ON newsletter_subscribers
      FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'newsletter_subscribers' AND policyname = 'Authenticated manage newsletter'
  ) THEN
    CREATE POLICY "Authenticated manage newsletter"
      ON newsletter_subscribers
      FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- =============================================
-- 2. ENSURE business_settings TABLE EXISTS
-- (for navbar ads, newsletter modal config)
-- =============================================
CREATE TABLE IF NOT EXISTS business_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_settings_key ON business_settings(key);

-- RLS for business_settings
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'business_settings' AND policyname = 'Public read settings'
  ) THEN
    CREATE POLICY "Public read settings"
      ON business_settings
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'business_settings' AND policyname = 'Authenticated manage settings'
  ) THEN
    CREATE POLICY "Authenticated manage settings"
      ON business_settings
      FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- =============================================
-- 3. STORAGE BUCKETS FOR ADS & NEWSLETTER IMAGES
-- Ensure 'offers' bucket exists (also used for ads/newsletter images)
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('offers', 'offers', true),
  ('newsletter', 'newsletter', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for newsletter images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public read newsletter'
  ) THEN
    CREATE POLICY "Public read newsletter" ON storage.objects FOR SELECT USING (bucket_id = 'newsletter');
  END IF;
END $$;

-- Allow anyone to upload to newsletter bucket (for subscription flow)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth upload newsletter'
  ) THEN
    CREATE POLICY "Auth upload newsletter" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'newsletter');
  END IF;
END $$;

-- =============================================
-- 4. SEED DEFAULT NAVBAR ADS SETTINGS
-- =============================================
INSERT INTO business_settings (key, value) VALUES
  ('navbarAds', '{"enabled": true, "items": ["FREE DELIVERY ON ORDERS OVER KES 2,000", "FRESHLY BAKED DAILY", "ORDER BY 5PM FOR NEXT-DAY DELIVERY", "CUSTOM CAKES — ORDER 48 HRS IN ADVANCE", "WHOLESALE ORDERS AVAILABLE"]}'),
  ('newsletterModal', '{"enabled": true, "title": "Subscribe Now", "subtitle": "Newsletter", "description": "Get 15% off your first order when you subscribe to our newsletter. Stay updated with exclusive offers and new arrivals.", "image": "", "discountCode": "WELCOME15", "delaySeconds": 5}')
ON CONFLICT (key) DO NOTHING;
