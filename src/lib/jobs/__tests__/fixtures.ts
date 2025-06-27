import { Job, JobDependency } from '@/lib/types/jobs';

// ISO timestamps for fixture data
const now = new Date('2025-01-01T00:00:00Z').toISOString();
const fiveMinutesLater = new Date('2025-01-01T00:05:00Z').toISOString();

/* -------------------------------------------------------------------------- */
/*                               Sample Jobs                                  */
/* -------------------------------------------------------------------------- */

export const pendingFetchDiffJob: Job = {
  id: '00000000-0000-0000-0000-000000000001',
  type: 'fetch_diff',
  status: 'pending',
  priority: 10,
  data: {
    commit_sha: 'abc123',
    repository_owner: 'octocat',
    repository_name: 'hello-world',
  },
  context: {},
  attempts: 0,
  max_attempts: 3,
  scheduled_for: now,
  created_at: now,
  updated_at: now,
};

export const runningGenerateSummaryJob: Job = {
  id: '00000000-0000-0000-0000-000000000002',
  type: 'generate_summary',
  status: 'running',
  priority: 8,
  data: {
    commit_id: '11111111-2222-3333-4444-555555555555',
    diff_content: 'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt',
  },
  context: {},
  attempts: 1,
  max_attempts: 3,
  scheduled_for: now,
  started_at: now,
  created_at: now,
  updated_at: now,
};

export const failedJobWithRetry: Job = {
  id: '00000000-0000-0000-0000-000000000003',
  type: 'generate_summary',
  status: 'failed',
  priority: 5,
  data: {
    commit_id: 'a1b2c3d4',
    diff_content: 'diff content',
  },
  context: {},
  attempts: 2,
  max_attempts: 3,
  retry_after: fiveMinutesLater,
  scheduled_for: now,
  error_message: 'OpenAI API error: rate_limit_exceeded',
  error_details: { code: 'rate_limit_exceeded' },
  created_at: now,
  updated_at: now,
};

export const completedSendEmailJob: Job = {
  id: '00000000-0000-0000-0000-000000000004',
  type: 'send_email',
  status: 'completed',
  priority: 1,
  data: {
    commit_ids: ['111', '222'],
    recipients: ['dev@example.com'],
    template_type: 'digest',
  },
  context: {},
  attempts: 1,
  max_attempts: 3,
  scheduled_for: now,
  started_at: now,
  completed_at: now,
  created_at: now,
  updated_at: now,
};

/**
 * Aggregated job list used in most tests.
 */
export const sampleJobs: Job[] = [
  pendingFetchDiffJob,
  runningGenerateSummaryJob,
  failedJobWithRetry,
  completedSendEmailJob,
];

/* -------------------------------------------------------------------------- */
/*                           Sample Dependencies                              */
/* -------------------------------------------------------------------------- */

export const sampleDependencies: JobDependency[] = [
  {
    id: '10000000-0000-0000-0000-000000000000',
    job_id: runningGenerateSummaryJob.id,
    depends_on_job_id: pendingFetchDiffJob.id,
    created_at: now,
  },
]; 