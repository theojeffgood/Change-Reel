/**
 * Job Processing Types and Interfaces
 * 
 * Type definitions for the job processing system that orchestrates
 * commit workflows including diff fetching, AI summarization, and email notifications.
 */

// Job status enumeration
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// Job type enumeration  
export type JobType = 'fetch_diff' | 'generate_summary' | 'send_email' | 'webhook_processing';

// Base job interface
export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: number; // 0-100, higher = more urgent
  
  // Job data and context
  data: Record<string, any>; // Job-specific payload
  context?: Record<string, any>; // Additional metadata
  
  // Related entities
  commit_id?: string;
  project_id?: string;
  
  // Retry handling
  attempts: number;
  max_attempts: number;
  retry_after?: string; // ISO timestamp
  
  // Processing tracking
  started_at?: string; // ISO timestamp
  completed_at?: string; // ISO timestamp
  error_message?: string;
  error_details?: Record<string, any>;
  
  // Scheduling
  scheduled_for: string; // ISO timestamp
  expires_at?: string; // ISO timestamp
  
  // Audit fields
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

// Job dependency relationship
export interface JobDependency {
  id: string;
  job_id: string;
  depends_on_job_id: string;
  created_at: string;
}

// Job creation data
export interface CreateJobData {
  type: JobType;
  priority?: number;
  data: Record<string, any>;
  context?: Record<string, any>;
  commit_id?: string;
  project_id?: string;
  max_attempts?: number;
  scheduled_for?: string; // ISO timestamp
  expires_at?: string; // ISO timestamp
}

// Job update data
export interface UpdateJobData {
  status?: JobStatus;
  priority?: number;
  data?: Record<string, any>;
  context?: Record<string, any>;
  attempts?: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  error_details?: Record<string, any>;
  retry_after?: string;
}

// Job processing result
export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

// Job filter for queries
export interface JobFilter {
  status?: JobStatus | JobStatus[];
  type?: JobType | JobType[];
  project_id?: string;
  commit_id?: string;
  priority_min?: number;
  priority_max?: number;
  scheduled_after?: string;
  scheduled_before?: string;
  created_after?: string;
  created_before?: string;
}

// Job-specific data interfaces

// Diff fetching job data
export interface FetchDiffJobData {
  commit_sha: string;
  repository_owner: string;
  repository_name: string;
  branch?: string;
  base_sha?: string; // optional base commit for comparison
  github_token?: string; // Will be retrieved from OAuth storage
}

// Summary generation job data  
export interface GenerateSummaryJobData {
  commit_id: string;
  diff_content: string;
  commit_message?: string;
  author?: string;
  branch?: string;
}

// Email sending job data
export interface SendEmailJobData {
  commit_ids: string[];
  recipients: string[];
  template_type: 'single_commit' | 'digest' | 'weekly_summary';
  template_data?: Record<string, any>;
}

// Webhook processing job data
export interface WebhookProcessingJobData {
  webhook_event: string;
  payload: Record<string, any>;
  signature: string;
  delivery_id: string;
}

// Job queue statistics
export interface JobQueueStats {
  total_jobs: number;
  pending_jobs: number;
  running_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  avg_processing_time_ms?: number;
  oldest_pending_job?: string; // ISO timestamp
}

// Job processing configuration
export interface JobProcessingConfig {
  max_concurrent_jobs?: number;
  retry_delay_ms?: number;
  max_retry_delay_ms?: number;
  exponential_backoff?: boolean;
  job_timeout_ms?: number;
  cleanup_completed_after_days?: number;
}

// Database result types for jobs
export interface DatabaseJobResult<T = Job> {
  data: T | null;
  error: Error | null;
}

export interface DatabaseJobResults<T = Job> {
  data: T[] | null;
  error: Error | null;
  count?: number;
}

// Job handler interface
export interface JobHandler<TData = any, TResult = any> {
  type: JobType;
  handle(job: Job, data: TData): Promise<JobResult>;
  validate?(data: TData): boolean;
  getEstimatedDuration?(data: TData): number; // milliseconds
}

// Job queue service interface
export interface IJobQueueService {
  // Job CRUD operations
  createJob(jobData: CreateJobData): Promise<DatabaseJobResult>;
  getJob(jobId: string): Promise<DatabaseJobResult>;
  updateJob(jobId: string, updates: UpdateJobData): Promise<DatabaseJobResult>;
  deleteJob(jobId: string): Promise<DatabaseJobResult>;
  
  // Job queue operations
  getReadyJobs(limit?: number): Promise<DatabaseJobResults>;
  getJobsByFilter(filter: JobFilter): Promise<DatabaseJobResults>;
  getQueueStats(): Promise<JobQueueStats>;
  
  // Job dependencies
  addJobDependency(jobId: string, dependsOnJobId: string): Promise<DatabaseJobResult<JobDependency>>;
  removeJobDependency(jobId: string, dependsOnJobId: string): Promise<DatabaseJobResult>;
  getJobDependencies(jobId: string): Promise<DatabaseJobResults<JobDependency>>;
  
  // Job lifecycle
  markJobAsRunning(jobId: string): Promise<DatabaseJobResult>;
  markJobAsCompleted(jobId: string, result?: any): Promise<DatabaseJobResult>;
  markJobAsFailed(jobId: string, error: string, details?: any): Promise<DatabaseJobResult>;
  scheduleRetry(jobId: string, retryAfter: Date): Promise<DatabaseJobResult>;
  
  // Cleanup and maintenance
  cleanupCompletedJobs(daysOld?: number): Promise<number>;
  cleanupExpiredJobs(): Promise<number>;
  // Maintenance helpers
  getStaleRunningJobs(timeoutMs: number): Promise<DatabaseJobResults>;
}

// Job processor interface
export interface IJobProcessor {
  // Processor lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  
  // Handler management
  registerHandler(handler: JobHandler): void;
  unregisterHandler(type: JobType): void;
  getHandler(type: JobType): JobHandler | undefined;
  
  // Processing configuration
  configure(config: JobProcessingConfig): void;
  getConfiguration(): JobProcessingConfig;
  
  // Monitoring
  getStats(): Promise<JobQueueStats>;
  getActiveJobs(): Promise<Job[]>;
}

// Commit workflow job creation helpers
export interface CommitWorkflowJobs {
  fetch_diff: CreateJobData;
  generate_summary: CreateJobData;
  send_email?: CreateJobData; // Optional for MVP
}

// Factory function result for creating commit workflow
export interface CreateCommitWorkflowResult {
  jobs: Job[];
  dependencies: JobDependency[];
  workflow_id: string;
} 