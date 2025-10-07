-- Migration: 014_enable_realtime_commits
-- Description: Enable Supabase Realtime for commits table to support real-time updates
-- This allows clients to subscribe to changes without polling

-- Step 1: Ensure supabase_realtime publication exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
        RAISE NOTICE 'Created supabase_realtime publication';
    ELSE
        RAISE NOTICE 'supabase_realtime publication already exists';
    END IF;
END $$;

-- Step 2: Add commits table to publication (idempotent)
DO $$
BEGIN
    -- Remove if exists, then add (ensures clean state)
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE commits;
    EXCEPTION
        WHEN undefined_table THEN NULL;
    END;
    
    ALTER PUBLICATION supabase_realtime ADD TABLE commits;
    RAISE NOTICE 'Added commits table to supabase_realtime publication';
END $$;

-- Step 3: Verify setup
DO $$
DECLARE
    table_count integer;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'commits';
    
    IF table_count > 0 THEN
        RAISE NOTICE '✅ SUCCESS: commits table is published for realtime';
    ELSE
        RAISE WARNING '❌ FAILED: commits table NOT in supabase_realtime publication';
    END IF;
END $$;

-- Comment for documentation
COMMENT ON TABLE commits IS 'Git commits with AI-generated summaries. Realtime enabled for live summary updates.';