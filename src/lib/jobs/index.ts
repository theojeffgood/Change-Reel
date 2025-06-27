/**
 * Job Processing System Exports
 * 
 * Main entry point for the job processing system that provides
 * all necessary components for handling commit workflows.
 */

// Core processor
export { JobProcessor, createJobProcessor } from './processor'

// Job handlers
export { FetchDiffHandler } from './handlers/fetch-diff-handler'
export { GenerateSummaryHandler } from './handlers/generate-summary-handler'
export { SendEmailHandler } from './handlers/send-email-handler'
export { WebhookProcessingHandler } from './handlers/webhook-processing-handler'

// Re-export types for convenience
export type {
  Job,
  JobType,
  JobStatus,
  JobHandler,
  JobResult,
  JobProcessingConfig,
  JobQueueStats,
  IJobProcessor,
  IJobQueueService,
  CreateJobData,
  UpdateJobData,
  JobFilter,
  FetchDiffJobData,
  GenerateSummaryJobData,
  SendEmailJobData,
  WebhookProcessingJobData,
  CommitWorkflowJobs,
  CreateCommitWorkflowResult,
} from '../types/jobs' 