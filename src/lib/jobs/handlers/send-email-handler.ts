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
import { renderDailyDigestHtml } from '@/lib/email/templates/digest'
import { createEmailTrackingService, IEmailTrackingService } from '@/lib/supabase/services/emails'

/**
 * Handler for sending email notifications with commit summaries
 * 
 * This handler:
 * 1. Retrieves commit data and summaries for the specified commits
 * 2. Formats the email content based on template type
 * 3. Sends emails to the specified recipients
 * 4. Marks commits as email_sent if successful
 * 
 * Note: For MVP, this is a placeholder implementation
 * In production, this would integrate with an email service like SendGrid or SES
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

      // Validate that all commits have summaries
      const commitsWithoutSummary = commits.filter(commit => !commit.summary)
      if (commitsWithoutSummary.length > 0) {
        return {
          success: false,
          error: 'Some commits do not have summaries generated yet',
          metadata: {
            reason: 'missing_summaries',
            commitsWithoutSummary: commitsWithoutSummary.map(c => c.id),
          },
        }
      }

      // Get project information for email context
      let projectName = 'Unknown Project'
      if (commits[0]?.project_id) {
        const projectResult = await this.projectService.getProject(commits[0].project_id)
        if (projectResult.data) {
          projectName = projectResult.data.name
        }
      }

      // Build subject/body (plain) and HTML
      const emailContent = this.formatEmailContent(commits, data.template_type, projectName, data.template_data)
      const html = this.renderHtml(commits, data.template_type, projectName, data.template_data)

      const from = process.env.RESEND_FROM_EMAIL || 'no-reply@changereel.local'

      // Record email send attempt (queued)
      const record = await this.emailTracking.recordEmailSend({
        project_id: commits[0]?.project_id || null,
        commit_ids: commits.map(c => c.id),
        recipients: data.recipients,
        template_type: data.template_type,
        provider: 'resend',
        status: 'queued',
      })
      const recordId = record.data?.id || ''

      // Send via client
      const sendRes = await this.emailClient.sendEmail({
        to: data.recipients,
        from,
        subject: emailContent.subject,
        html,
      })

      // Update tracking status
      if (recordId) {
        await this.emailTracking.markEmailSendStatus(recordId, 'sent')
      }

      // Mark commits as email sent
      const markResults = []
      for (const commit of commits) {
        const markResult = await this.commitService.markCommitAsEmailSent(commit.id)
        markResults.push(markResult)
      }

      // Check if any marking failed
      const failedMarks = markResults.filter(result => result.error)
      if (failedMarks.length > 0) {
        return {
          success: false,
          error: 'Failed to mark some commits as email sent',
          metadata: {
            reason: 'database_update_failed',
            failedCommits: failedMarks.length,
          },
        }
      }

      return {
        success: true,
        data: {
          recipients: data.recipients,
          commit_count: commits.length,
          template_type: data.template_type,
          email_content_preview: emailContent.subject,
        },
        metadata: {
          projectName,
          commitIds: data.commit_ids,
          recipientCount: data.recipients.length,
          emailContentLength: emailContent.body.length,
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

  private formatEmailContent(
    commits: Commit[],
    templateType: string,
    projectName: string,
    templateData?: Record<string, any>
  ): { subject: string; body: string } {
    switch (templateType) {
      case 'single_commit':
        // Unified subject line per request
        {
          const sc = this.formatSingleCommitEmail(commits[0], projectName)
          return { subject: `We saw a change to ${projectName}` , body: sc.body }
        }
      
      case 'digest':
        {
          const dg = this.formatDigestEmail(commits, projectName, templateData)
          return { subject: `We saw a change to ${projectName}`, body: dg.body }
        }
      
      case 'weekly_summary':
        {
          const ws = this.formatWeeklySummaryEmail(commits, projectName, templateData)
          return { subject: `We saw a change to ${projectName}`, body: ws.body }
        }
      
      default:
        return { subject: `We saw a change to ${projectName}`, body: `${commits.length} commits processed.` }
    }
  }

  private formatSingleCommitEmail(commit: Commit, projectName: string): { subject: string; body: string } {
    return {
      subject: `${projectName}: ${commit.summary || 'New commit'}`,
      body: `
A new commit has been made to ${projectName}:

📝 Summary: ${commit.summary}
👤 Author: ${commit.author}
🔗 SHA: ${commit.sha}
📅 Date: ${new Date(commit.timestamp).toLocaleDateString()}

This is an automated notification from Change Reel.
      `.trim(),
    }
  }

  private formatDigestEmail(commits: Commit[], projectName: string, templateData?: Record<string, any>): { subject: string; body: string } {
    const commitList = commits
      .map(commit => `• ${commit.summary} (by ${commit.author})`)
      .join('\n')

    return {
      subject: `${projectName}: ${commits.length} new commits`,
      body: `
${commits.length} new commits have been made to ${projectName}:

${commitList}

This is your automated digest from Change Reel.
      `.trim(),
    }
  }

  private formatWeeklySummaryEmail(commits: Commit[], projectName: string, templateData?: Record<string, any>): { subject: string; body: string } {
    const typeGroups = commits.reduce((groups, commit) => {
      const type = commit.type || 'other'
      if (!groups[type]) groups[type] = []
      groups[type].push(commit)
      return groups
    }, {} as Record<string, Commit[]>)

    let body = `Weekly summary for ${projectName}:\n\n`
    
    Object.entries(typeGroups).forEach(([type, groupCommits]) => {
      body += `${type.toUpperCase()}:\n`
      groupCommits.forEach(commit => {
        body += `• ${commit.summary} (by ${commit.author})\n`
      })
      body += '\n'
    })

    body += 'This is your weekly summary from Change Reel.'

    return {
      subject: `${projectName}: Weekly Summary (${commits.length} commits)`,
      body: body.trim(),
    }
  }

  private renderHtml(
    commits: Commit[],
    templateType: string,
    projectName: string,
    templateData?: Record<string, any>
  ): string {
    switch (templateType) {
      case 'single_commit': {
        const c = commits[0]
        const data = {
          projectName,
          commits: [
            {
              summary: (c.summary ?? null),
              author: (c.author ?? null),
              sha: c.sha,
              timestamp: c.timestamp,
            },
          ],
        }
        return renderDailyDigestHtml(data)
      }
      case 'digest':
      case 'weekly_summary': {
        const data = {
          projectName,
          commits: commits.map(c => ({
            summary: (c.summary ?? null),
            author: (c.author ?? null),
            sha: c.sha,
            timestamp: c.timestamp,
          })),
        }
        return renderDailyDigestHtml(data)
      }
      default: {
        const data = {
          projectName,
          commits: commits.map(c => ({
            summary: (c.summary ?? null),
            author: (c.author ?? null),
            sha: c.sha,
            timestamp: c.timestamp,
          })),
        }
        return renderDailyDigestHtml(data)
      }
    }
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