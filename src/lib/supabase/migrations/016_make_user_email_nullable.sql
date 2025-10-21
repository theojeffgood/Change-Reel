-- Migration: 016_make_user_email_nullable
-- Description: Allow users to be created without an email; backfill handled in app logic

ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL;

-- Note: Unique constraint remains; Postgres allows multiple NULLs in a UNIQUE column

