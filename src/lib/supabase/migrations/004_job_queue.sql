-- Migration: 004_job_queue.sql
-- Description: Create job processing system for commit workflow automation
-- Date: 2025-06-27

-- Job status enumeration
CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- Job type enumeration
CREATE TYPE job_type AS ENUM ('fetch_diff', 'generate_summary', 'send_email', 'webhook_processing');

-- Jobs table for processing queue
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type job_type NOT NULL,
    status job_status NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 0, -- Higher number = higher priority
    
    -- Job data and context
    data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Job-specific data
    context JSONB DEFAULT '{}'::jsonb, -- Additional context/metadata
    
    -- Related entities
    commit_id UUID REFERENCES commits(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Retry handling
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    retry_after TIMESTAMP WITH TIME ZONE, -- When to retry after failure
    
    -- Processing tracking
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    error_details JSONB,
    
    -- Scheduling
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- Job expiration (optional)
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT jobs_priority_valid CHECK (priority >= 0 AND priority <= 100),
    CONSTRAINT jobs_attempts_valid CHECK (attempts >= 0 AND attempts <= max_attempts),
    CONSTRAINT jobs_max_attempts_valid CHECK (max_attempts > 0 AND max_attempts <= 10),
    CONSTRAINT jobs_scheduling_valid CHECK (scheduled_for IS NOT NULL),
    CONSTRAINT jobs_completion_logic CHECK (
        (status = 'completed' AND completed_at IS NOT NULL) OR 
        (status != 'completed' AND completed_at IS NULL)
    ),
    CONSTRAINT jobs_start_logic CHECK (
        (status IN ('running', 'completed', 'failed') AND started_at IS NOT NULL) OR 
        (status NOT IN ('running', 'completed', 'failed') AND started_at IS NULL)
    )
);

-- Job dependencies table for workflow orchestration
CREATE TABLE IF NOT EXISTS job_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    depends_on_job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Prevent self-dependencies and duplicates
    CONSTRAINT job_dependencies_no_self_reference CHECK (job_id != depends_on_job_id),
    CONSTRAINT job_dependencies_unique UNIQUE (job_id, depends_on_job_id)
);

-- Indexes for performance
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_type ON jobs(type);
CREATE INDEX idx_jobs_priority ON jobs(priority DESC);
CREATE INDEX idx_jobs_scheduled_for ON jobs(scheduled_for);
CREATE INDEX idx_jobs_project_id ON jobs(project_id);
CREATE INDEX idx_jobs_commit_id ON jobs(commit_id);
CREATE INDEX idx_jobs_retry_after ON jobs(retry_after) WHERE retry_after IS NOT NULL;
CREATE INDEX idx_jobs_expires_at ON jobs(expires_at) WHERE expires_at IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_jobs_status_priority ON jobs(status, priority DESC, scheduled_for ASC);
CREATE INDEX idx_jobs_processing_queue ON jobs(status, scheduled_for, priority DESC) 
    WHERE status IN ('pending', 'failed');
CREATE INDEX idx_jobs_retry_after ON jobs(retry_after) WHERE retry_after IS NOT NULL;
CREATE INDEX idx_jobs_commit_workflow ON jobs(commit_id, type, status);

-- Indexes for job dependencies
CREATE INDEX idx_job_dependencies_job_id ON job_dependencies(job_id);
CREATE INDEX idx_job_dependencies_depends_on ON job_dependencies(depends_on_job_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_jobs_updated_at();

-- Function to validate job workflow dependencies
CREATE OR REPLACE FUNCTION validate_job_dependencies()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent circular dependencies (simple check)
    IF EXISTS (
        SELECT 1 FROM job_dependencies 
        WHERE job_id = NEW.depends_on_job_id 
        AND depends_on_job_id = NEW.job_id
    ) THEN
        RAISE EXCEPTION 'Circular dependency detected between jobs % and %', NEW.job_id, NEW.depends_on_job_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to validate dependencies
CREATE TRIGGER validate_job_dependencies_trigger
    BEFORE INSERT OR UPDATE ON job_dependencies
    FOR EACH ROW
    EXECUTE FUNCTION validate_job_dependencies();

-- Function to get ready jobs (respects dependencies)
CREATE OR REPLACE FUNCTION get_ready_jobs(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID,
    type job_type,
    priority INTEGER,
    data JSONB,
    context JSONB,
    commit_id UUID,
    project_id UUID,
    scheduled_for TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.id,
        j.type,
        j.priority,
        j.data,
        j.context,
        j.commit_id,
        j.project_id,
        j.scheduled_for
    FROM jobs j
    WHERE j.status = 'pending'
        AND j.scheduled_for <= NOW()
        AND (j.retry_after IS NULL OR j.retry_after <= NOW())
        AND (j.expires_at IS NULL OR j.expires_at > NOW())
        AND NOT EXISTS (
            -- Check that all dependencies are completed
            SELECT 1 FROM job_dependencies jd
            JOIN jobs dep_job ON jd.depends_on_job_id = dep_job.id
            WHERE jd.job_id = j.id
            AND dep_job.status != 'completed'
        )
    ORDER BY j.priority DESC, j.scheduled_for ASC
    LIMIT limit_count;
END;
$$ language 'plpgsql';

-- Function to clean up old completed jobs
CREATE OR REPLACE FUNCTION cleanup_completed_jobs(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM jobs 
    WHERE status IN ('completed', 'cancelled')
    AND completed_at < NOW() - INTERVAL '1 day' * days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Enable Row Level Security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_dependencies ENABLE ROW LEVEL SECURITY;

-- Policies for MVP (allow all for service role)
CREATE POLICY "Service role can manage jobs" ON jobs FOR ALL USING (true);
CREATE POLICY "Service role can manage job dependencies" ON job_dependencies FOR ALL USING (true);

-- Comments for documentation
COMMENT ON TABLE jobs IS 'Job processing queue for automated commit workflow';
COMMENT ON TABLE job_dependencies IS 'Job dependency relationships for workflow orchestration';

COMMENT ON COLUMN jobs.type IS 'Type of job to be processed';
COMMENT ON COLUMN jobs.status IS 'Current status of job processing';
COMMENT ON COLUMN jobs.priority IS 'Job priority (0-100, higher = more urgent)';
COMMENT ON COLUMN jobs.data IS 'Job-specific payload data (JSON)';
COMMENT ON COLUMN jobs.context IS 'Additional context and metadata (JSON)';
COMMENT ON COLUMN jobs.attempts IS 'Number of processing attempts made';
COMMENT ON COLUMN jobs.retry_after IS 'Earliest time to retry failed job';
COMMENT ON COLUMN jobs.scheduled_for IS 'When the job should be processed';
COMMENT ON COLUMN jobs.expires_at IS 'When the job should be considered expired';

COMMENT ON FUNCTION get_ready_jobs(INTEGER) IS 'Get jobs ready for processing (respects dependencies and scheduling)';
COMMENT ON FUNCTION cleanup_completed_jobs(INTEGER) IS 'Clean up old completed jobs to manage database size'; 