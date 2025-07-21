-- Migration: 005_add_webhook_secret
-- Description: Add webhook_secret column to projects table for secure webhook verification

-- Add webhook_secret column to projects table
ALTER TABLE projects 
ADD COLUMN webhook_secret VARCHAR(255);

-- Create an index for faster lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_projects_webhook_secret ON projects(webhook_secret);

-- Add comment for documentation
COMMENT ON COLUMN projects.webhook_secret IS 'Secret key used for webhook signature verification'; 