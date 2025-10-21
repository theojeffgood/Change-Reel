import {
  Job,
  JobHandler,
  JobResult,
  SendEmailJobData,
} from '../../types/jobs'

import { ICommitService } from '../../supabase/services/commits'
import { IProjectService } from '../../supabase/services/projects'
import { Commit } from '../../types/supabase'
import { IEmailClient } from '@/lib/email/types'
import { renderSingleCommitEmail } from '@/lib/email/templates/digest'
import { createEmailTrackingService, IEmailTrackingService } from '@/lib/supabase/services/emails'

/**
 * Handler for sending email notifications with commit summaries
 * 
 * This handler:
 * 1. Retrieves commit data and summaries for the specified commits
 * 2. Formats the email content based on template type
 * 3. Sends emails to the specified recipients
 * 4. Marks commits as email_sent if successful
 */
export class SendEmailHandler implements JobHandler<SendEmailJobData> {
  type = 'send_email' as const

  constructor(
    private commitService: ICommitService,
    private projectService: IProjectService,
    private emailClient: IEmailClient,
    private emailTracking: IEmailTrackingService
  ) {}

  async handle(job: Job, data: SendEmailJobData): Promise<JobResult> {
    try {
      // Validate job data
      if (!this.validate(data)) {
        return {
          success: false,
          error: 'Invalid job data for send_email handler',
        }
      }

      // Fetch commit data for email content
      const commits: Commit[] = []
      for (const commitId of data.commit_ids) {
        const commitResult = await this.commitService.getCommit(commitId)
        if (commitResult.error || !commitResult.data) {
          return {
            success: false,
            error: `Failed to retrieve commit ${commitId} for email`,
            metadata: {
              reason: 'commit_not_found',
              commitId,
            },
          }
        }
        commits.push(commitResult.data)
      }

      // Get project information for email context
      let projectName = 'Unknown Project'
      if (commits[0]?.project_id) {
        const projectResult = await this.projectService.getProject(commits[0].project_id)
        if (projectResult.data) {
          projectName = projectResult.data.name
        }
      }

      const rawFrom = process.env.RESEND_FROM_EMAIL || 'no-reply@changereel.local'
      const formattedFrom = `Change Reel <${rawFrom}>`
      let sentCount = 0
      for (const commit of commits) {
        if (!commit.summary) {
          return {
            success: false,
            error: 'Some commits do not have summaries generated yet',
          }
        }

        const content = renderSingleCommitEmail({
          projectName,
          commit: {
            summary: commit.summary ?? '',
            author: commit.author ?? null,
            // sha: commit.sha,
            timestamp: commit.timestamp,
            type: commit.type,
          },
        })

        const record = await this.emailTracking.recordEmailSend({
          project_id: commit.project_id || null,
          commit_ids: [commit.id],
          recipients: data.recipients,
          template_type: 'single_commit',
          provider: 'resend',
          status: 'queued',
        })
        const recordId = record.data?.id || ''

        await this.emailClient.sendEmail({
          to: data.recipients,
          from: formattedFrom,
          subject: content.subject,
          html: content.html,
        })

        if (recordId) {
          await this.emailTracking.markEmailSendStatus(recordId, 'sent')
        }

        await this.commitService.markCommitAsEmailSent(commit.id)
        sentCount += 1
      }

      return {
        success: true,
        data: {
          recipients: data.recipients,
          commit_count: sentCount,
          template_type: 'single_commit',
          email_content_preview: 'We saw a change notification',
        },
        metadata: {
          projectName,
          commitIds: data.commit_ids,
          recipientCount: data.recipients.length,
          emailContentLength: 0,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in send_email handler',
        metadata: {
          jobId: job.id,
          commitIds: data.commit_ids,
        },
      }
    }
  }

  validate(data: SendEmailJobData): boolean {
    return !!(
      data &&
      data.commit_ids &&
      Array.isArray(data.commit_ids) &&
      data.commit_ids.length > 0 &&
      data.commit_ids.every(id => typeof id === 'string' && id.trim().length > 0) &&
      data.recipients &&
      Array.isArray(data.recipients) &&
      data.recipients.length > 0 &&
      data.recipients.every(email => this.isValidEmail(email)) &&
      data.template_type &&
      ['single_commit', 'digest', 'weekly_summary'].includes(data.template_type)
    )
  }

  getEstimatedDuration(data: SendEmailJobData): number {
    // Estimate based on number of commits and recipients
    const baseTime = 2000 // 2 seconds base time
    const commitMultiplier = data.commit_ids.length * 500 // 500ms per commit
    const recipientMultiplier = data.recipients.length * 200 // 200ms per recipient
    
    return baseTime + commitMultiplier + recipientMultiplier
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
  }

  
}

// Factory function for dependency injection
export function createSendEmailHandler(
  commitService: ICommitService,
  projectService: IProjectService,
  emailClient: IEmailClient,
  supabaseClient: any
): SendEmailHandler {
  const tracking = createEmailTrackingService(supabaseClient)
  return new SendEmailHandler(commitService, projectService, emailClient, tracking)
}