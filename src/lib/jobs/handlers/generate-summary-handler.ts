import {
  Job,
  JobHandler,
  JobResult,
  GenerateSummaryJobData,
} from '../../types/jobs'

import { ISummarizationService } from '../../openai/summarization-service'
import { createBillingService } from '../../supabase/services/billing'
import { ISupabaseClient } from '../../types/supabase'
import { IJobQueueService } from '../../types/jobs'
import { ICommitService } from '../../supabase/services/commits'

/**
 * Handler for generating AI-powered commit summaries
 * 
 * This handler:
 * 1. Retrieves the commit and diff data
 * 2. Generates a plain-English summary using OpenAI
 * 3. Stores the summary in the commit record
 * 4. Handles rate limiting and API errors gracefully
 */
export class GenerateSummaryHandler implements JobHandler<GenerateSummaryJobData> {
  type = 'generate_summary' as const

  constructor(
    private summarizationService: ISummarizationService,
    private commitService: ICommitService,
    private jobQueueService: IJobQueueService,
    private supabaseClient?: ISupabaseClient
  ) {}

  async handle(job: Job, data: GenerateSummaryJobData): Promise<JobResult> {
    try {
      // Validate job data
      if (!this.validate(data)) {
        return {
          success: false,
          error: 'Invalid job data for generate_summary handler',
        }
      }

      // Get the commit record to access diff content
      const commitResult = await this.commitService.getCommit(data.commit_id)
      if (commitResult.error || !commitResult.data) {
        return {
          success: false,
          error: 'Failed to retrieve commit record',
          metadata: {
            reason: 'commit_not_found',
            commitId: data.commit_id,
          },
        }
      }

      const commit = commitResult.data

      // Use diff content from job data if provided; otherwise from previous/completed job context
      let diffContent = data.diff_content

      // Check current job's context (supports both {result:{diff_content}} and {result:{data:{diff_content}}})
      if (!diffContent) {
        const fromContextDirect = job.context && (job.context as any).result && (job.context as any).result.diff_content
        const fromContextNested = job.context && (job.context as any).result && (job.context as any).result.data && (job.context as any).result.data.diff_content
        diffContent = fromContextDirect || fromContextNested
      }

      // If still missing, load dependency job and read its context (supports both shapes)
      if (!diffContent) {
        const deps = await this.jobQueueService.getJobDependencies(job.id)
        const depId = deps.data && deps.data[0]?.depends_on_job_id
        if (depId) {
          const dep = await this.jobQueueService.getJob(depId)
          const depCtx = (dep.data as any)?.context?.result
          const fromDepDirect = depCtx?.diff_content
          const fromDepNested = depCtx?.data?.diff_content
          diffContent = fromDepDirect || fromDepNested
        }
      }

      if (!diffContent) {
        return {
          success: false,
          error: 'No diff content available for summarization',
          metadata: {
            reason: 'missing_diff_content',
            commitId: data.commit_id,
          },
        }
      }

      // Prepare summarization context
      const summaryContext = {
        commitMessage: data.commit_message || '',
        author: data.author || commit.author || '',
        branch: data.branch || '',
        repository: '', // Not available in current Commit interface
      }

      // Billing: resolve user from project_id (projects.user_id)
      let userId: string | undefined
      if (this.supabaseClient && job.project_id) {
        const { data: proj } = await this.supabaseClient
          .from('projects')
          .select('user_id')
          .eq('id', job.project_id)
          .maybeSingle()
        userId = (proj as any)?.user_id || undefined
      }
      if (userId && this.supabaseClient) {
        const billing = createBillingService(this.supabaseClient)
        // Pre-check only: ensure user has at least 1 credit per summary
        const requiredCredits = await billing.estimateSummaryCredits(diffContent)
        const has = await billing.hasCredits(userId, requiredCredits)
        if (!has) {
          return { success: false, error: 'Insufficient credits' }
        }
      }

      // Generate the summary using OpenAI
      try {
        console.log('[GenerateSummary] Calling summarization service', {
          jobId: job.id,
          commitId: data.commit_id,
          diffChars: diffContent.length,
        })
      } catch {}
      const summaryResult = await this.summarizationService.processDiff(
        diffContent,
        {
          customContext: `Commit by ${summaryContext.author}${summaryContext.commitMessage ? ': ' + summaryContext.commitMessage : ''}`,
          includeMetadata: true,
        }
      )
      try {
        console.log('[GenerateSummary] Summarization complete', {
          jobId: job.id,
          commitId: data.commit_id,
          summaryChars: summaryResult.summary?.length || 0,
          tokensUsed: summaryResult.metadata?.tokensUsed,
          timeMs: summaryResult.metadata?.processingTimeMs,
        })
      } catch {}

      if (!summaryResult.summary) {
        return {
          success: false,
          error: 'Failed to generate commit summary - no summary returned',
          metadata: {
            reason: 'summarization_failed',
            commitId: data.commit_id,
          },
        }
      }

      // Update the commit record with the generated summary
      const updateResult = await this.commitService.updateCommit(data.commit_id, {
        summary: summaryResult.summary,
        type: summaryResult.changeType, // Use detected change type
      })

      if (updateResult.error) {
        return {
          success: false,
          error: 'Failed to save summary to commit record',
          metadata: {
            reason: 'database_update_failed',
            commitId: data.commit_id,
            dbError: updateResult.error.message,
            summary: summaryResult.summary, // Include summary for potential retry
          },
        }
      }

      // Post-charge: deduct exactly 1 credit per completed summary under new pricing
      if (userId && this.supabaseClient) {
        try {
          const billing = createBillingService(this.supabaseClient)
          await billing.deductCredits(userId, 1, 'Commit summary (1 credit)')
        } catch (e) {
          // If deduction fails here, we leave summary saved but log the issue for follow-up
          // A future reconciliation task can handle this path
          // eslint-disable-next-line no-console
          console.error('Post-charge deduction failed:', e)
        }
      }

      return {
        success: true,
        data: {
          summary: summaryResult.summary,
          commit_id: data.commit_id,
          change_type: summaryResult.changeType,
          confidence: summaryResult.confidence,
          tokens_used: summaryResult.metadata.tokensUsed,
        },
        metadata: {
          commitId: data.commit_id,
          repository: summaryContext.repository,
          summaryLength: summaryResult.summary.length,
          processingTimeMs: summaryResult.metadata.processingTimeMs,
          templateUsed: summaryResult.metadata.templateUsed,
        },
      }
    } catch (error) {
      const meta: any = {
        jobId: job.id,
        commitId: data.commit_id,
      }
      const anyErr = error as any
      if (anyErr && (anyErr.code || anyErr.details)) {
        meta.error_code = anyErr.code || undefined
        if (anyErr.details) {
          meta.finish_reason = anyErr.details.finish_reason
          meta.completion_tokens = anyErr.details.completion_tokens
          meta.total_tokens = anyErr.details.total_tokens
          meta.max_tokens = anyErr.details.max_tokens
          meta.model = anyErr.details.model
          meta.operation = anyErr.details.operation
        }
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in generate_summary handler',
        metadata: meta,
      }
    }
  }

  validate(data: GenerateSummaryJobData): boolean {
    return !!(
      data &&
      data.commit_id &&
      data.commit_id.trim().length > 0 &&
      // diff_content can be provided directly or retrieved from previous job context
      (data.diff_content || true)
    )
  }

  getEstimatedDuration(data: GenerateSummaryJobData): number {
    // Estimate based on diff content size and OpenAI API response times
    // Larger diffs take longer to process
    const baseTime = 8000 // 8 seconds base time
    
    if (data.diff_content) {
      // Rough estimate: 1ms per character of diff content
      const diffSizeMultiplier = Math.min(data.diff_content.length, 50000) // Cap at 50k chars
      return baseTime + diffSizeMultiplier
    }
    
    return baseTime
  }
}

// Factory function for dependency injection
export function createGenerateSummaryHandler(
  summarizationService: ISummarizationService,
  commitService: ICommitService,
  jobQueueService: IJobQueueService
): GenerateSummaryHandler {
  return new GenerateSummaryHandler(summarizationService, commitService, jobQueueService)
}
