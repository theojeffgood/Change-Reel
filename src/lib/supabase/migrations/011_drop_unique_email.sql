-- Migration: 011_drop_unique_email
-- Description: Remove UNIQUE constraint on users.email

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_email_key;

-- Optional: If a unique index was created separately (unlikely here), drop it too
-- DROP INDEX IF EXISTS users_email_key;

