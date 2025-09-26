-- Add is_tracked flag to projects to control which repos are summarized/visible
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS is_tracked boolean NOT NULL DEFAULT true;

-- Backfill existing rows to true (explicitly)
UPDATE projects SET is_tracked = COALESCE(is_tracked, true);

-- Optional index to filter by user_id and tracking quickly
CREATE INDEX IF NOT EXISTS idx_projects_user_tracked ON projects (user_id, is_tracked);

