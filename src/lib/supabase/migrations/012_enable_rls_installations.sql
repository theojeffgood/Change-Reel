-- Migration: 012_enable_rls_installations
-- Description: Enable RLS on installations table to avoid unrestricted access

ALTER TABLE installations ENABLE ROW LEVEL SECURITY;

-- Deliberately no public policies; service role will bypass RLS.
-- Add policies later if client-side reads are needed.

COMMENT ON TABLE installations IS 'GitHub App installations mapping (RLS enabled; server-side only)';

