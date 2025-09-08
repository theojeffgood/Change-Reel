import {
  Job,
  JobHandler,
  JobResult,
  WebhookProcessingJobData,
  CreateJobData,
} from '../../types/jobs'

import { IJobService } from '../../supabase/services/jobs'
import { ICommitService } from '../../supabase/services/commits'
import { IProjectService } from '../../supabase/services/projects'

/**
 * Handler for processing GitHub webhook events
 * 
 * This handler:
 * 1. Validates the webhook payload and signature
 * 2. Extracts commit information from push events
 * 3. Creates commit records in the database
 * 4. Creates follow-up jobs for diff fetching and summarization
 * 5. Handles webhook event logging and error tracking
 */
export class WebhookProcessingHandler implements JobHandler<WebhookProcessingJobData> {
  type = 'webhook_processing' as const

  constructor(
    private jobQueueService: IJobService,
    private commitService: ICommitService,
    private projectService: IProjectService
  ) {}

  async handle(job: Job, data: WebhookProcessingJobData): Promise<JobResult> {
    try {
      // Validate job data
      if (!this.validate(data)) {
        return {
          success: false,
          error: 'Invalid job data for webhook_processing handler',
        }
      }

      // MVP: Simple webhook processing without full parsing
      // In production, this would use the webhook service for proper validation
      console.log('🔗 Processing webhook:', data.webhook_event)
      console.log('🔗 Delivery ID:', data.delivery_id)
      console.log('🔗 Payload:', JSON.stringify(data.payload, null, 2))

      // Only process push events for MVP
      if (data.webhook_event !== 'push') {
        return {
          success: true,
          data: {
            event: data.webhook_event,
            action: 'ignored',
            reason: 'not_a_push_event',
          },
          metadata: {
            event: data.webhook_event,
            deliveryId: data.delivery_id,
          },
        }
      }

      // Lookup project by repository name
      const repository = data.payload.repository?.full_name || 'unknown/repo'
      const commits = data.payload.commits || []
      
      // Get the actual project from the database
      const projectResult = await this.projectService.getProjectByRepository(repository)
      
      if (projectResult.error || !projectResult.data) {
        return {
          success: false,
          error: `No project found for repository: ${repository}. Please configure the project first.`,
          metadata: {
            reason: 'project_not_found',
            repository,
            projectError: projectResult.error?.message,
          },
        }
      }

      const project = projectResult.data
      const createdCommits: string[] = []
      const createdJobs: string[] = []

       // Process each commit in the push
       for (const commitData of commits) {
        // Create commit record
        const createCommitResult = await this.commitService.createCommit({
          project_id: project.id,
          sha: commitData.id,
          author: commitData.author.name || commitData.author.email,
          timestamp: commitData.timestamp,
          is_published: false,
          email_sent: false,
        })

        if (createCommitResult.error) {
          // Skip if commit already exists
          if (createCommitResult.error.message.includes('already exists')) {
            continue
          }
          
          return {
            success: false,
            error: `Failed to create commit record: ${createCommitResult.error.message}`,
            metadata: {
              reason: 'commit_creation_failed',
              commitSha: commitData.id,
              dbError: createCommitResult.error.message,
            },
          }
        }

        const commit = createCommitResult.data!
        createdCommits.push(commit.id)

                 // Create fetch_diff job
        const fetchDiffJobData: CreateJobData = {
           type: 'fetch_diff',
           priority: 70, // High priority for fresh commits
           data: {
             commit_sha: commitData.id,
             repository_owner: data.payload.repository?.owner?.login || 'unknown',
             repository_name: data.payload.repository?.name || 'unknown',
             branch: data.payload.ref?.replace('refs/heads/', '') || 'main',
            base_sha: (data.payload.before && data.payload.before !== '0000000000000000000000000000000000000000') 
              ? data.payload.before 
              : undefined,
           },
           commit_id: commit.id,
           project_id: project.id,
           context: {
             webhook_delivery_id: data.delivery_id,
             triggered_by: 'webhook',
           },
         }

        const fetchJobResult = await this.jobQueueService.createJob(fetchDiffJobData)
        if (fetchJobResult.error || !fetchJobResult.data) {
          return {
            success: false,
            error: 'Failed to create fetch_diff job',
            metadata: {
              reason: 'job_creation_failed',
              jobType: 'fetch_diff',
              commitId: commit.id,
            },
          }
        }

        const fetchJob = fetchJobResult.data
        createdJobs.push(fetchJob.id)

                 // Create generate_summary job (depends on fetch_diff)
         const summaryJobData: CreateJobData = {
           type: 'generate_summary',
           priority: 60, // Medium-high priority
           data: {
             commit_id: commit.id,
             commit_message: commitData.message,
             author: commitData.author?.name || commitData.author?.email || 'unknown',
             branch: data.payload.ref?.replace('refs/heads/', '') || 'main',
           },
           commit_id: commit.id,
           project_id: project.id,
           context: {
             webhook_delivery_id: data.delivery_id,
             triggered_by: 'webhook',
           },
         }

        const summaryJobResult = await this.jobQueueService.createJob(summaryJobData)
        if (summaryJobResult.error || !summaryJobResult.data) {
          return {
            success: false,
            error: 'Failed to create generate_summary job',
            metadata: {
              reason: 'job_creation_failed',
              jobType: 'generate_summary',
              commitId: commit.id,
            },
          }
        }

        const summaryJob = summaryJobResult.data
        createdJobs.push(summaryJob.id)

        // Add dependency: summary job depends on fetch job
        const dependencyResult = await this.jobQueueService.addJobDependency(
          summaryJob.id,
          fetchJob.id
        )

        if (dependencyResult.error) {
          return {
            success: false,
            error: 'Failed to create job dependency',
            metadata: {
              reason: 'dependency_creation_failed',
              dependentJob: summaryJob.id,
              dependsOnJob: fetchJob.id,
            },
          }
        }
      }

             return {
         success: true,
         data: {
           event: data.webhook_event,
           repository: repository,
           commits_processed: createdCommits.length,
           jobs_created: createdJobs.length,
           commit_ids: createdCommits,
           job_ids: createdJobs,
         },
         metadata: {
           projectId: project.id,
           projectName: project.name,
           deliveryId: data.delivery_id,
           webhookEvent: data.webhook_event,
           branchRef: data.payload.ref || 'unknown',
         },
       }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in webhook_processing handler',
        metadata: {
          jobId: job.id,
          deliveryId: data.delivery_id,
          webhookEvent: data.webhook_event,
        },
      }
    }
  }

  validate(data: WebhookProcessingJobData): boolean {
    return !!(
      data &&
      data.webhook_event &&
      typeof data.webhook_event === 'string' &&
      data.payload &&
      typeof data.payload === 'object' &&
      data.signature &&
      typeof data.signature === 'string' &&
      data.delivery_id &&
      typeof data.delivery_id === 'string' &&
      data.webhook_event.trim().length > 0 &&
      data.signature.trim().length > 0 &&
      data.delivery_id.trim().length > 0
    )
  }

  getEstimatedDuration(data: WebhookProcessingJobData): number {
    // Estimate based on webhook complexity
    // Push events with multiple commits take longer
    const baseTime = 3000 // 3 seconds base time
    
    if (data.payload?.commits && Array.isArray(data.payload.commits)) {
      // Add 2 seconds per commit for processing
      return baseTime + (data.payload.commits.length * 2000)
    }
    
    return baseTime
  }
}

// Factory function for dependency injection
export function createWebhookProcessingHandler(
  jobQueueService: IJobService,
  commitService: ICommitService,
  projectService: IProjectService
): WebhookProcessingHandler {
  return new WebhookProcessingHandler(
    jobQueueService,
    commitService,
    projectService
  )
} 