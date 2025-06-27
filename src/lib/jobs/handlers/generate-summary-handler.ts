import {
  Job,
  JobHandler,
  JobResult,
  GenerateSummaryJobData,
} from '../../types/jobs'

import { ISummarizationService } from '../../openai/summarization-service'
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
    private commitService: ICommitService
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

      // Use diff content from job data if provided, otherwise try to get from previous job result
      let diffContent = data.diff_content
      if (!diffContent && job.context?.previous_job_result?.data?.diff_content) {
        diffContent = job.context.previous_job_result.data.diff_content
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

      // Generate the summary using OpenAI
      const summaryResult = await this.summarizationService.processDiff(
        diffContent,
        {
          customContext: `Commit by ${summaryContext.author}${summaryContext.commitMessage ? ': ' + summaryContext.commitMessage : ''}`,
          includeMetadata: true,
        }
      )

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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in generate_summary handler',
        metadata: {
          jobId: job.id,
          commitId: data.commit_id,
        },
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
  commitService: ICommitService
): GenerateSummaryHandler {
  return new GenerateSummaryHandler(summarizationService, commitService)
} 