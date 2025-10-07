-- Migration: 015_add_installation_id_to_commits
-- Description: Add installation_id to commits table for efficient realtime filtering
-- This allows us to subscribe to commits by installation without needing project_id

-- Step 1: Add installation_id column (nullable initially for backfill)
ALTER TABLE commits ADD COLUMN installation_id INTEGER;

-- Step 2: Backfill installation_id from projects table
UPDATE commits c
SET installation_id = p.installation_id
FROM projects p
WHERE c.project_id = p.id
AND p.installation_id IS NOT NULL;

-- Step 3: Make installation_id NOT NULL (after backfill)
ALTER TABLE commits ALTER COLUMN installation_id SET NOT NULL;

-- Step 4: Add index for performance
CREATE INDEX idx_commits_installation_id ON commits(installation_id);

-- Step 5: Create composite index for common realtime queries
CREATE INDEX idx_commits_installation_timestamp ON commits(installation_id, timestamp DESC);

-- Step 6: Add comment
COMMENT ON COLUMN commits.installation_id IS 'GitHub App installation ID - denormalized from projects for efficient realtime filtering';

