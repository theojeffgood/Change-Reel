-- Migration: 002_oauth_tokens.sql
-- Description: Create table for storing encrypted OAuth tokens
-- Date: 2025-06-25

-- Create oauth_tokens table for storing encrypted OAuth tokens
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  encrypted_token text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  provider varchar(50) NOT NULL DEFAULT 'github',
  scopes text[] NOT NULL DEFAULT '{}',
  token_version integer NOT NULL DEFAULT 1,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate tokens per user/provider
ALTER TABLE oauth_tokens ADD CONSTRAINT oauth_tokens_user_provider_unique 
  UNIQUE (user_id, provider);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_id ON oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider ON oauth_tokens(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own tokens
CREATE POLICY "Users can access their own tokens" ON oauth_tokens
  FOR ALL USING (true); -- For MVP, allow all access since auth is deferred

-- Add comments for documentation
COMMENT ON TABLE oauth_tokens IS 'Stores encrypted OAuth tokens for external service authentication';
COMMENT ON COLUMN oauth_tokens.user_id IS 'Identifier for the user who owns this token';
COMMENT ON COLUMN oauth_tokens.encrypted_token IS 'AES-256-GCM encrypted OAuth access token';
COMMENT ON COLUMN oauth_tokens.iv IS 'Initialization vector for token encryption';
COMMENT ON COLUMN oauth_tokens.auth_tag IS 'Authentication tag for GCM encryption';
COMMENT ON COLUMN oauth_tokens.provider IS 'OAuth provider (github, gitlab, etc.)';
COMMENT ON COLUMN oauth_tokens.scopes IS 'Array of OAuth scopes granted to this token';
COMMENT ON COLUMN oauth_tokens.token_version IS 'Version number for token rotation (incremented on each update)';
COMMENT ON COLUMN oauth_tokens.expires_at IS 'Token expiration timestamp (null if no expiration)';

-- Create function to update updated_at automatically
CREATE OR REPLACE FUNCTION update_oauth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at column
CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_oauth_tokens_updated_at(); 