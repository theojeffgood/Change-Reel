-- Migration: 999_cleanup_oauth_deprecated.sql
-- Description: Remove deprecated OAuth tokens table and webhook_secret column
-- Date: 2024-01-20
-- 
-- This migration cleans up database objects that are no longer needed
-- after migrating to the GitHub App model.

-- Drop the oauth_tokens table and all related objects
-- (This reverses migrations 002_oauth_tokens.sql and 003_add_token_version.sql)

-- Drop trigger first
DROP TRIGGER IF EXISTS update_oauth_tokens_updated_at ON oauth_tokens;

-- Drop function
DROP FUNCTION IF EXISTS update_oauth_tokens_updated_at();

-- Drop table (this will automatically drop all indexes and constraints)
DROP TABLE IF EXISTS oauth_tokens;

-- Remove webhook_secret column from projects table  
-- (This reverses migration 005_add_webhook_secret.sql)

-- Drop index for webhook_secret column
DROP INDEX IF EXISTS idx_projects_webhook_secret;

-- Drop the webhook_secret column
ALTER TABLE projects DROP COLUMN IF EXISTS webhook_secret;

-- Add comment to document the cleanup
COMMENT ON TABLE projects IS 'Project configuration table (cleaned up for GitHub App model)';
