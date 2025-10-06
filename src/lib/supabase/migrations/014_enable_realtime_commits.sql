-- Migration: 014_enable_realtime_commits
-- Description: Enable Supabase Realtime for commits table to support real-time updates
-- This allows clients to subscribe to changes without polling

-- Enable realtime for the commits table
ALTER PUBLICATION supabase_realtime ADD TABLE commits;

-- Comment for documentation
COMMENT ON TABLE commits IS 'Git commits with AI-generated summaries. Realtime enabled for live summary updates.';