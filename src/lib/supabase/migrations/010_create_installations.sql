-- Migration: 010_create_installations
-- Description: Create installations table to map GitHub App installations to Wins Column users

CREATE TABLE IF NOT EXISTS installations (
  installation_id BIGINT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'github',
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_login TEXT,
  account_id BIGINT,
  account_type TEXT, -- 'User' or 'Organization'
  installed_repos_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installations_user_id ON installations(user_id);
CREATE INDEX IF NOT EXISTS idx_installations_provider ON installations(provider);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION set_updated_at_installations()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_installations_updated_at ON installations;
CREATE TRIGGER update_installations_updated_at
  BEFORE UPDATE ON installations
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_installations();

COMMENT ON TABLE installations IS 'Maps GitHub App installations to Wins Column users and metadata';

