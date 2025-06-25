-- Migration: 003_add_token_version.sql
-- Description: Add token_version column to existing oauth_tokens table
-- Date: 2025-06-25

-- Add token_version column to existing oauth_tokens table
ALTER TABLE oauth_tokens 
ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 1;

-- Add comment for the new column
COMMENT ON COLUMN oauth_tokens.token_version IS 'Version number for token rotation (incremented on each update)';

-- Create index for token_version if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_token_version ON oauth_tokens(token_version); 