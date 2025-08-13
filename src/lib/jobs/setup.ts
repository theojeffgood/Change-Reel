/**
 * Job Processing System Setup
 * 
 * Factory functions and configuration for setting up the complete
 * job processing system with all handlers registered and ready to use.
 */

import { ISupabaseClient } from '../types/supabase'
import { IJobQueueService } from '../types/jobs'
import { JobQueueService } from '../supabase/services/jobs'
import {
  JobProcessor,
  FetchDiffHandler,
  GenerateSummaryHandler,
  SendEmailHandler,
  WebhookProcessingHandler,
  createJobProcessor,
} from './index'

// Service dependencies for handlers
export interface JobSystemDependencies {
  supabaseClient: ISupabaseClient
  commitService?: any // Will be injected when available
  openaiService?: any // Will be injected when available
  githubDiffService?: any // Will be injected when available
  tokenStorage?: any // Will be injected when available
  projectService?: any // Will be injected when available
  webhookService?: any // Will be injected when available
  userService?: any // Will be injected when available
}

/**
 * Creates and configures the complete job processing system
 * with all handlers registered and ready to process jobs.
 */
export function createJobProcessingSystem(dependencies: JobSystemDependencies) {
  const { supabaseClient } = dependencies

  // Create job queue service
  const jobQueueService: IJobQueueService = new JobQueueService(supabaseClient)

  // Create job processor
  const processor = createJobProcessor(jobQueueService)

  // Create and register all job handlers
  const handlers = {
    fetchDiff: new FetchDiffHandler(
      dependencies.githubDiffService,
      dependencies.commitService,
      dependencies.projectService,
      dependencies.userService
    ),
    generateSummary: new GenerateSummaryHandler(
      dependencies.openaiService,
      dependencies.commitService,
      jobQueueService
    ),
    sendEmail: new SendEmailHandler(
      dependencies.commitService,
      dependencies.projectService
    ),
    webhookProcessing: new WebhookProcessingHandler(
      dependencies.webhookService,
      jobQueueService,
      dependencies.commitService,
      dependencies.projectService
    ),
  }

  // Register all handlers with the processor
  Object.values(handlers).forEach(handler => {
    processor.registerHandler(handler)
  })

  return {
    processor,
    jobQueueService,
    handlers,
    
    // Convenience methods
    async start() {
      await processor.start()
      return this
    },
    
    async stop() {
      await processor.stop()
      return this
    },
    
    // Configuration helpers
    configure(config: Parameters<typeof processor.configure>[0]) {
      processor.configure(config)
      return this
    },
    
    // Monitoring helpers
    async getStats() {
      return processor.getStats()
    },
    
    async getActiveJobs() {
      return processor.getActiveJobs()
    },
    
    // Handler access
    getHandler(type: Parameters<typeof processor.getHandler>[0]) {
      return processor.getHandler(type)
    },
  }
}

/**
 * Type for the complete job processing system
 */
export type JobProcessingSystem = ReturnType<typeof createJobProcessingSystem>

/**
 * Creates a minimal job processing system for testing
 * or environments where not all dependencies are available
 */
export function createMinimalJobProcessingSystem(supabaseClient: ISupabaseClient) {
  const jobQueueService: IJobQueueService = new JobQueueService(supabaseClient)
  const processor = createJobProcessor(jobQueueService)

  return {
    processor,
    jobQueueService,
    
    // Register handlers as they become available
    registerHandler: processor.registerHandler.bind(processor),
    
    async start() {
      await processor.start()
      return this
    },
    
    async stop() {
      await processor.stop()
      return this
    },
  }
}

/**
 * Default job processing configuration for production
 */
export const PRODUCTION_CONFIG = {
  max_concurrent_jobs: 10,
  retry_delay_ms: 2000,
  max_retry_delay_ms: 60000,
  exponential_backoff: true,
  job_timeout_ms: 600000, // 10 minutes
  cleanup_completed_after_days: 7,
}

/**
 * Default job processing configuration for development
 */
export const DEVELOPMENT_CONFIG = {
  max_concurrent_jobs: 3,
  retry_delay_ms: 1000,
  max_retry_delay_ms: 10000,
  exponential_backoff: true,
  job_timeout_ms: 300000, // 5 minutes
  cleanup_completed_after_days: 1,
}

/**
 * Utility function to create commit processing workflow jobs
 * This is the main entry point for processing new commits
 */
export async function createCommitWorkflow(
  jobQueueService: IJobQueueService,
  commitId: string,
  projectId: string,
  repositoryOwner: string,
  repositoryName: string,
  commitSha: string
) {
  try {
    // Create fetch diff job (first in the workflow)
    const fetchDiffJob = await jobQueueService.createJob({
      type: 'fetch_diff',
      priority: 50,
      data: {
        commit_sha: commitSha,
        repository_owner: repositoryOwner,
        repository_name: repositoryName,
      },
      commit_id: commitId,
      project_id: projectId,
    })

    if (fetchDiffJob.error || !fetchDiffJob.data) {
      throw new Error(`Failed to create fetch diff job: ${fetchDiffJob.error?.message}`)
    }

    // Create summary generation job (depends on fetch diff)
    const generateSummaryJob = await jobQueueService.createJob({
      type: 'generate_summary',
      priority: 40,
      data: {
        commit_id: commitId,
        diff_content: '', // Will be filled after fetch diff completes
      },
      commit_id: commitId,
      project_id: projectId,
    })

    if (generateSummaryJob.error || !generateSummaryJob.data) {
      throw new Error(`Failed to create summary job: ${generateSummaryJob.error?.message}`)
    }

    // Create dependency between jobs
    const dependency = await jobQueueService.addJobDependency(
      generateSummaryJob.data.id,
      fetchDiffJob.data.id
    )

    if (dependency.error) {
      throw new Error(`Failed to create job dependency: ${dependency.error.message}`)
    }

    return {
      workflow_id: `workflow_${commitId}_${Date.now()}`,
      jobs: [fetchDiffJob.data, generateSummaryJob.data],
      dependencies: dependency.data ? [dependency.data] : [],
    }
  } catch (error) {
    throw new Error(`Failed to create commit workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
} 