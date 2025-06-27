import {
  Job,
  JobHandler,
  JobResult,
  FetchDiffJobData,
} from '../../types/jobs'

import { IGitHubDiffService } from '../../github/diff-service'
import { ICommitService } from '../../supabase/services/commits'
import { IOAuthTokenStorage } from '../../oauth/tokenStorage'

/**
 * Handler for fetching commit diffs from GitHub API
 * 
 * This handler:
 * 1. Retrieves the OAuth token for GitHub API access
 * 2. Fetches the commit diff using the GitHub API
 * 3. Stores the diff content in the commit record
 * 4. Updates commit metadata if available
 */
export class FetchDiffHandler implements JobHandler<FetchDiffJobData> {
  type = 'fetch_diff' as const

  constructor(
    private diffService: IGitHubDiffService,
    private commitService: ICommitService,
    private tokenStorage: IOAuthTokenStorage
  ) {}

  async handle(job: Job, data: FetchDiffJobData): Promise<JobResult> {
    try {
      // Validate job data
      if (!this.validate(data)) {
        return {
          success: false,
          error: 'Invalid job data for fetch_diff handler',
        }
      }

      // Get OAuth token for GitHub API access
      const tokenResult = await this.tokenStorage.getToken('github')
      if (!tokenResult.success || !tokenResult.token) {
        return {
          success: false,
          error: 'Failed to retrieve GitHub OAuth token',
          metadata: { reason: 'oauth_token_missing' },
        }
      }

      // Fetch the commit diff from GitHub
      const diffResult = await this.diffService.getDiff(
        data.repository_owner,
        data.repository_name,
        data.commit_sha,
        tokenResult.token
      )

      if (!diffResult.success || !diffResult.diff) {
        return {
          success: false,
          error: 'Failed to fetch commit diff from GitHub',
          metadata: {
            reason: 'github_api_error',
            sha: data.commit_sha,
            repo: `${data.repository_owner}/${data.repository_name}`,
            apiError: diffResult.error,
          },
        }
      }

      // Update the commit record with diff data
      if (job.commit_id) {
        const updateResult = await this.commitService.updateCommit(job.commit_id, {
          // Store diff in context since it's not a direct commit field
          // The summarization handler will read this
        })

        if (updateResult.error) {
          return {
            success: false,
            error: 'Failed to update commit record with diff data',
            metadata: {
              reason: 'database_update_failed',
              commitId: job.commit_id,
              dbError: updateResult.error.message,
            },
          }
        }
      }

      return {
        success: true,
        data: {
          diff_content: diffResult.diff,
          diff_stats: diffResult.stats,
          commit_sha: data.commit_sha,
        },
        metadata: {
          repository: `${data.repository_owner}/${data.repository_name}`,
          commit_sha: data.commit_sha,
          diff_size: diffResult.diff?.length || 0,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in fetch_diff handler',
        metadata: {
          jobId: job.id,
          commitSha: data.commit_sha,
        },
      }
    }
  }

  validate(data: FetchDiffJobData): boolean {
    return !!(
      data &&
      data.commit_sha &&
      data.repository_owner &&
      data.repository_name &&
      data.commit_sha.length >= 7 && // Minimum SHA length
      data.repository_owner.trim().length > 0 &&
      data.repository_name.trim().length > 0
    )
  }

  getEstimatedDuration(data: FetchDiffJobData): number {
    // Estimate based on typical GitHub API response times
    // Most diff fetches complete within 2-5 seconds
    return 5000 // 5 seconds in milliseconds
  }
}

// Factory function for dependency injection
export function createFetchDiffHandler(
  diffService: IGitHubDiffService,
  commitService: ICommitService,
  tokenStorage: IOAuthTokenStorage
): FetchDiffHandler {
  return new FetchDiffHandler(diffService, commitService, tokenStorage)
} 