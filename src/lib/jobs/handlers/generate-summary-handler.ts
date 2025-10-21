import {
  Job,
  JobHandler,
  JobResult,
  GenerateSummaryJobData,
} from '../../types/jobs'

import { ISummarizationService } from '../../openai/summarization-service'
import {
  DiffSummaryMetadata,
  FileChangeSummary,
  PullRequestSummary,
} from '../../openai/prompt-templates'
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

  private static readonly MAX_FILE_CHANGES = 25
  private static readonly MAX_PR_DESCRIPTION_LENGTH = 600
  private static readonly MAX_CONTEXT_MESSAGE_LENGTH = 600

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
      let dependencyContext: any = null

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
          dependencyContext = depCtx || dependencyContext
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
      const summaryContext = this.buildSummaryContext(data, commit, job, dependencyContext)
      const summaryMetadata = await this.buildSummaryMetadata(
        job,
        data,
        dependencyContext
      )
      const customContext = this.buildCustomContext(summaryContext)

      // Billing: resolve user from project_id (projects.user_id) and enforce presence
      let userId: string | undefined
      if (this.supabaseClient && job.project_id) {
        const { data: proj } = await this.supabaseClient
          .from('projects')
          .select('user_id')
          .eq('id', job.project_id)
          .maybeSingle()
        userId = (proj as any)?.user_id || undefined
      }
      if (!userId) {
        return { success: false, error: 'Project is not linked to a user (billing required)', metadata: { reason: 'project_missing_user', commitId: data.commit_id, projectId: job.project_id } }
      }
      if (this.supabaseClient) {
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
          customContext,
          includeMetadata: true,
          summaryMetadata,
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
      const storedType: 'feature' | 'bugfix' | undefined = summaryResult.changeType;

      const headerPrefix = summaryResult.header ? `${summaryResult.header}\n\n` : ''
      const updateResult = await this.commitService.updateCommit(data.commit_id, {
        summary: `${headerPrefix}${summaryResult.summary}`.trim(),
        type: storedType,
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

      // Immediately enqueue send_email if project has configured recipients
      try {
        if (this.supabaseClient && job.project_id && !commit.email_sent) {
          const { data: proj } = await this.supabaseClient
            .from('projects')
            .select('email_distribution_list')
            .eq('id', job.project_id)
            .maybeSingle()

          const recipients: string[] = Array.isArray((proj as any)?.email_distribution_list)
            ? (proj as any).email_distribution_list.filter((e: any) => typeof e === 'string' && e.trim())
            : []

          if (recipients.length > 0) {
            await this.jobQueueService.createJob({
              type: 'send_email',
              priority: 30,
              data: {
                commit_ids: [data.commit_id],
                recipients,
                template_type: 'single_commit',
              },
              commit_id: data.commit_id,
              project_id: job.project_id,
              scheduled_for: new Date().toISOString(),
              max_attempts: 1,
            })
          }
        }
      } catch (e) {
        // Non-fatal: summary succeeded; email scheduling failed
        // eslint-disable-next-line no-console
        console.warn('[GenerateSummary] Failed to enqueue send_email job:', (e as any)?.message || e)
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

  private buildSummaryContext(
    data: GenerateSummaryJobData,
    commit: any,
    job: Job,
    dependencyContext?: any
  ): {
    author: string
    commitMessage: string
    branch: string
    repository?: string
  } {
    const author = (data.author || commit?.author || 'unknown').trim()
    const branch = (data.branch || '').trim()
    const commitMessage = data.commit_message || ''

    const repository =
      (data as any)?.repository ||
      this.extractRepositoryFromContext(job?.context) ||
      this.extractRepositoryFromContext((job?.context as any)?.result) ||
      this.extractRepositoryFromContext(dependencyContext) ||
      ''

    return {
      author,
      branch,
      commitMessage,
      repository,
    }
  }

  private buildCustomContext(context: {
    author: string
    commitMessage: string
    branch: string
    repository?: string
  }): string {
    const lines: string[] = []

    if (context.author) {
      lines.push(`Author: ${context.author}`)
    }

    if (context.branch) {
      lines.push(`Branch: ${context.branch}`)
    }

    if (context.repository) {
      lines.push(`Repository: ${context.repository}`)
    }

    if (context.commitMessage && context.commitMessage.trim()) {
      lines.push('Commit Message:')
      lines.push(
        this.indent(
          this.truncate(
            context.commitMessage.trim(),
            GenerateSummaryHandler.MAX_CONTEXT_MESSAGE_LENGTH
          ),
          '  '
        )
      )
    }

    return lines.join('\n')
  }

  private async buildSummaryMetadata(
    job: Job,
    data: GenerateSummaryJobData,
    dependencyContext?: any
  ): Promise<DiffSummaryMetadata | undefined> {
    const fileChanges = await this.resolveFileChanges(job, data, dependencyContext)
    const pullRequest = this.resolvePullRequest(data, job, dependencyContext)
    const issueReferences = this.resolveIssueReferences(job, data, pullRequest, dependencyContext)

    const metadata: DiffSummaryMetadata = {}

    if (fileChanges.length) {
      metadata.fileChanges = fileChanges
    }

    if (pullRequest) {
      metadata.pullRequest = pullRequest
    }

    if (issueReferences.length) {
      metadata.issueReferences = issueReferences
    }

    return Object.keys(metadata).length ? metadata : undefined
  }

  private async resolveFileChanges(
    job: Job,
    data: GenerateSummaryJobData,
    dependencyContext?: any
  ): Promise<FileChangeSummary[]> {
    const fromData = this.normalizeFileChanges(data.file_changes || [])
    if (fromData.length) {
      return fromData
    }

    const jobContext = (job.context as any) || {}
    const fromJobContext = this.normalizeFileChanges(this.extractFileChangesFromContext(jobContext))
    if (fromJobContext.length) {
      return fromJobContext
    }

    const fromJobResult = this.normalizeFileChanges(this.extractFileChangesFromContext(jobContext?.result))
    if (fromJobResult.length) {
      return fromJobResult
    }

    const fromDependency = this.normalizeFileChanges(this.extractFileChangesFromContext(dependencyContext))
    if (fromDependency.length) {
      return fromDependency
    }

    try {
      const deps = await this.jobQueueService.getJobDependencies(job.id)
      const depId = deps.data && deps.data[0]?.depends_on_job_id
      if (depId) {
        const dep = await this.jobQueueService.getJob(depId)
        const depCtx = (dep.data as any)?.context?.result
        const fromDepJob = this.normalizeFileChanges(this.extractFileChangesFromContext(depCtx))
        if (fromDepJob.length) {
          return fromDepJob
        }
      }
    } catch {
      // Metadata is optional; ignore dependency lookup failures
    }

    return []
  }

  private extractFileChangesFromContext(context: any): any[] {
    if (!context) {
      return []
    }

    if (Array.isArray(context.file_changes)) {
      return context.file_changes
    }

    if (Array.isArray(context?.data?.file_changes)) {
      return context.data.file_changes
    }

    if (Array.isArray(context?.result?.file_changes)) {
      return context.result.file_changes
    }

    return []
  }

  private normalizeFileChanges(changes: any[]): FileChangeSummary[] {
    if (!Array.isArray(changes) || !changes.length) {
      return []
    }

    const unique = new Map<string, FileChangeSummary>()

    for (const change of changes) {
      if (!change) continue

      const path = (change.path || change.filename || change.file || '').trim()
      if (!path) continue

      const additionsRaw = change.additions ?? change.added
      const deletionsRaw = change.deletions ?? change.removed

      const normalized: FileChangeSummary = {
        path,
        status: change.status || change.state || change.changeType,
        additions: typeof additionsRaw === 'number' ? additionsRaw : undefined,
        deletions: typeof deletionsRaw === 'number' ? deletionsRaw : undefined,
      }

      unique.set(path, normalized)
      if (unique.size >= GenerateSummaryHandler.MAX_FILE_CHANGES) {
        break
      }
    }

    return Array.from(unique.values())
  }

  private resolvePullRequest(
    data: GenerateSummaryJobData,
    job: Job,
    dependencyContext?: any
  ): PullRequestSummary | undefined {
    const candidates: Array<PullRequestSummary | undefined> = [
      data.pull_request,
      this.extractLoosePullRequest(data as Record<string, any>),
      this.extractPullRequestFromContext(job.context),
      this.extractPullRequestFromContext((job.context as any)?.result),
      this.extractPullRequestFromContext(dependencyContext),
    ]

    for (const candidate of candidates) {
      if (!candidate) continue

      const hasContent = Boolean(
        candidate.title ||
        candidate.description ||
        candidate.number !== undefined ||
        candidate.url
      )

      if (hasContent) {
        const pr: PullRequestSummary = { ...candidate }
        if (pr.description) {
          pr.description = this.truncate(
            pr.description,
            GenerateSummaryHandler.MAX_PR_DESCRIPTION_LENGTH
          )
        }
        return pr
      }
    }

    return undefined
  }

  private extractPullRequestFromContext(context: any): PullRequestSummary | undefined {
    if (!context) {
      return undefined
    }

    const candidate = context.pull_request || context.pr || context?.data?.pull_request
    if (!candidate) {
      return undefined
    }

    return {
      title: candidate.title || candidate.name || candidate.pr_title,
      description: candidate.description || candidate.body || candidate.pr_description,
      number: candidate.number ?? candidate.id ?? candidate.pr_number,
      url: candidate.url || candidate.html_url || candidate.pr_url,
    }
  }

  private extractLoosePullRequest(source: Record<string, any> | undefined): PullRequestSummary | undefined {
    if (!source) {
      return undefined
    }

    const title = source.pr_title || source.pull_request_title
    const description = source.pr_description || source.pull_request_description
    const number = source.pr_number ?? source.pull_request_number
    const url = source.pr_url || source.pull_request_url

    if (title || description || number !== undefined || url) {
      return { title, description, number, url }
    }

    return undefined
  }

  private resolveIssueReferences(
    job: Job,
    data: GenerateSummaryJobData,
    pullRequest: PullRequestSummary | undefined,
    dependencyContext?: any
  ): string[] {
    const references = new Set<string>()

    const addRefs = (values?: string[]) => {
      if (!values) return
      values
        .map(ref => (typeof ref === 'string' ? ref.trim() : ''))
        .filter(ref => ref.length > 0)
        .forEach(ref => references.add(ref))
    }

    addRefs(data.issue_references)
    addRefs(this.extractIssueReferencesFromContext(job.context))
    addRefs(this.extractIssueReferencesFromContext((job.context as any)?.result))
    addRefs(this.extractIssueReferencesFromContext(dependencyContext))

    this.parseIssueReferencesFromText(data.commit_message).forEach(ref => references.add(ref))
    if (pullRequest?.description) {
      this.parseIssueReferencesFromText(pullRequest.description).forEach(ref => references.add(ref))
    }

    return Array.from(references)
  }

  private extractIssueReferencesFromContext(context: any): string[] {
    if (!context) {
      return []
    }

    const references = context.issue_references || context.issues || context?.data?.issue_references
    if (!Array.isArray(references)) {
      return []
    }

    return references
      .map(ref => (typeof ref === 'string' ? ref.trim() : ''))
      .filter(ref => ref.length > 0)
  }

  private parseIssueReferencesFromText(text?: string): string[] {
    if (!text) {
      return []
    }

    const references = new Set<string>()
    const ticketPattern = /\b[A-Z][A-Z0-9]+-\d+\b/g
    const hashPattern = /#\d+/g

    const capture = (pattern: RegExp) => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => references.add(match))
      }
    }

    capture(ticketPattern)
    capture(hashPattern)

    return Array.from(references)
  }

  private extractRepositoryFromContext(context: any): string | undefined {
    if (!context) {
      return undefined
    }

    return (
      context.repository ||
      context.repo ||
      context?.data?.repository ||
      context?.metadata?.repository ||
      context?.result?.repository ||
      undefined
    )
  }

  private truncate(text: string, limit: number): string {
    if (!text || text.length <= limit) {
      return text
    }

    return `${text.slice(0, limit).trimEnd()}...`
  }

  private indent(text: string, indent: string): string {
    return text
      .split(/\r?\n/)
      .map(line => `${indent}${line}`)
      .join('\n')
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
