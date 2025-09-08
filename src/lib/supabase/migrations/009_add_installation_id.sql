-- Migration: 009_add_installation_id
-- Description: Add installation_id column to projects table for GitHub App installation context

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS installation_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_projects_installation_id ON projects(installation_id);

COMMENT ON COLUMN projects.installation_id IS 'GitHub App installation id associated with this project';


