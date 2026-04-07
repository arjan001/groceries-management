-- =============================================
-- MIGRATION: Add user activity tracking fields
-- Adds last_activity column to users table for online status tracking
-- =============================================

-- Add last_activity column for heartbeat-based online tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ;

-- Create index for efficient online status queries
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
