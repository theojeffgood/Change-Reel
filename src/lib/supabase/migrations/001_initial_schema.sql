-- Change Reel Database Schema
-- Migration: 001_initial_schema
-- Description: Create initial tables for users, projects, and commits

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
-- Note: Authentication features are deferred to post-MVP
-- This table is prepared for future use but may not be actively used in MVP
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    github_id VARCHAR(255),
    access_token TEXT, -- Encrypted GitHub access token (for future use)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
-- For MVP: single project configuration, user_id may be NULL
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    repo_name VARCHAR(255), -- GitHub repository name (owner/repo format)
    provider VARCHAR(50) NOT NULL DEFAULT 'github', -- 'github', 'gitlab', 'bitbucket'
    webhook_url TEXT, -- URL for webhook endpoint
    email_distribution_list JSONB DEFAULT '[]'::jsonb, -- Array of email addresses
    public_slug VARCHAR(255) UNIQUE, -- For public changelog URL (e.g., 'my-company')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT projects_provider_check CHECK (provider IN ('github', 'gitlab', 'bitbucket')),
    CONSTRAINT projects_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT projects_valid_slug CHECK (public_slug ~ '^[a-z0-9\-]+$' OR public_slug IS NULL)
);

-- Commits table
-- Stores commit information and AI-generated summaries
CREATE TABLE commits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sha VARCHAR(40) NOT NULL, -- Git commit SHA (40 characters for full SHA)
    author VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    summary TEXT, -- AI-generated natural language summary
    type VARCHAR(20), -- 'feature', 'fix', 'refactor', 'chore'
    is_published BOOLEAN DEFAULT FALSE, -- Whether commit is published to changelog
    email_sent BOOLEAN DEFAULT FALSE, -- Whether email notification was sent
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT commits_type_check CHECK (type IN ('feature', 'fix', 'refactor', 'chore') OR type IS NULL),
    CONSTRAINT commits_sha_format CHECK (sha ~ '^[a-f0-9]{7,40}$'), -- Allow short or full SHA
    CONSTRAINT commits_author_not_empty CHECK (length(trim(author)) > 0),
    
    -- Unique constraint on project_id + sha to prevent duplicates
    UNIQUE(project_id, sha)
);

-- Indexes for performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_provider ON projects(provider);
CREATE INDEX idx_projects_public_slug ON projects(public_slug) WHERE public_slug IS NOT NULL;

CREATE INDEX idx_commits_project_id ON commits(project_id);
CREATE INDEX idx_commits_sha ON commits(sha);
CREATE INDEX idx_commits_author ON commits(author);
CREATE INDEX idx_commits_timestamp ON commits(timestamp DESC);
CREATE INDEX idx_commits_type ON commits(type) WHERE type IS NOT NULL;
CREATE INDEX idx_commits_published ON commits(is_published) WHERE is_published = TRUE;
CREATE INDEX idx_commits_email_sent ON commits(email_sent) WHERE email_sent = TRUE;

-- Composite indexes for common queries
CREATE INDEX idx_commits_project_published ON commits(project_id, is_published, timestamp DESC);
CREATE INDEX idx_commits_project_type ON commits(project_id, type, timestamp DESC) WHERE type IS NOT NULL;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON projects 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commits_updated_at 
    BEFORE UPDATE ON commits 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
-- Note: For MVP, we'll use service role key, but preparing for future user-based access

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE commits ENABLE ROW LEVEL SECURITY;

-- For now, allow service role to access everything (MVP approach)
-- In post-MVP, these will be replaced with user-specific policies

-- Grant permissions to authenticated users (for future use)
-- These policies will be activated when authentication is implemented

-- Comments for future reference
COMMENT ON TABLE users IS 'User accounts - prepared for post-MVP authentication';
COMMENT ON TABLE projects IS 'Project configurations - MVP uses single project';
COMMENT ON TABLE commits IS 'Git commits with AI-generated summaries';

COMMENT ON COLUMN projects.email_distribution_list IS 'JSONB array of email addresses for changelog notifications';
COMMENT ON COLUMN commits.summary IS 'AI-generated natural language summary of commit changes';
COMMENT ON COLUMN commits.is_published IS 'Whether commit appears in public changelog';
COMMENT ON COLUMN commits.email_sent IS 'Whether email notification was sent for this commit'; 