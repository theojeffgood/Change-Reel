-- Normalize existing commit types to the new standard: feature | bugfix
-- Map legacy values:
--   fix      -> bugfix
--   refactor -> feature
--   chore    -> feature

BEGIN;

-- First, drop the existing constraint to allow updates
ALTER TABLE commits DROP CONSTRAINT IF EXISTS commits_type_check;

-- Update existing rows to conform to new standard
UPDATE commits SET type = 'bugfix' WHERE type = 'fix';
UPDATE commits SET type = 'feature' WHERE type IN ('refactor', 'chore');

-- Add the new constraint with only the allowed values
ALTER TABLE commits ADD CONSTRAINT commits_type_check CHECK (type IN ('feature', 'bugfix') OR type IS NULL);

COMMIT;


