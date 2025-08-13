import {
  Job,
  JobHandler,
  JobResult,
  FetchDiffJobData,
} from '../../types/jobs'

import { IDiffService, DiffReference, createDiffService } from '../../github/diff-service'
import { ICommitService } from '../../supabase/services/commits'
import { IProjectService } from '../../supabase/services/projects'
import { createGitHubClient } from '@/lib/github/api-client'
import { getOAuthToken } from '@/lib/auth/token-storage'

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
    private diffService: IDiffService | null,
    private commitService: ICommitService,
    private projectService: IProjectService,
    private userService: any
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

      // Get project to retrieve user information
      if (!job.project_id) {
        return {
          success: false,
          error: 'Project ID is required for OAuth token retrieval',
          metadata: { reason: 'missing_project_id' },
        }
      }

      const projectResult = await this.projectService.getProject(job.project_id)
      if (projectResult.error || !projectResult.data) {
        return {
          success: false,
          error: 'Failed to retrieve project information',
          metadata: { reason: 'project_not_found', projectId: job.project_id },
        }
      }

      const project = projectResult.data

             // Check if project has user_id
       if (!project.user_id) {
         return {
           success: false,
           error: 'Project does not have an associated user',
           metadata: { reason: 'missing_user_id', projectId: job.project_id },
         }
       }

       // Retrieve user-scoped GitHub OAuth token (bridge internal UUID -> GitHub ID)
       let tokenLookup = await getOAuthToken(project.user_id, 'github')
       if (!tokenLookup.token) {
         // Try mapping internal user UUID to github_id
         const userResult = await this.userService.getUser(project.user_id)
         const githubId = userResult?.data?.github_id ? String(userResult.data.github_id) : undefined
         if (githubId) {
           tokenLookup = await getOAuthToken(githubId, 'github')
         }
       }
       if (!tokenLookup.token) {
         return {
           success: false,
           error: 'Failed to retrieve GitHub OAuth token',
           metadata: { reason: 'oauth_token_missing', userId: project.user_id },
         }
       }

      // Validate repo/ref inputs and prepare diff reference
      const diffReference: DiffReference = {
        owner: data.repository_owner,
        repo: data.repository_name,
        base: data.base_sha || job.context?.base_sha || 'HEAD~1',
        head: data.commit_sha,
      }

      if (!diffReference.owner || diffReference.owner === 'unknown' || !diffReference.repo || diffReference.repo === 'unknown') {
        return {
          success: false,
          error: 'Invalid repository information for diff fetching',
          metadata: { reason: 'invalid_repo', owner: diffReference.owner, repo: diffReference.repo },
        }
      }
      if (!diffReference.head) {
        return {
          success: false,
          error: 'Missing commit SHA for diff fetching',
          metadata: { reason: 'missing_commit_sha' },
        }
      }

      // Use injected diff service if present; otherwise create per-user service
      let diffService = this.diffService
      if (!diffService) {
        const apiClient = createGitHubClient({ auth: tokenLookup.token })
        diffService = createDiffService(apiClient)
      }

      // Fetch the commit diff from GitHub
      const diffData = await diffService.getDiff(diffReference)
      const diffRaw = await diffService.getDiffRaw(diffReference)

      // Do not update commit with an empty payload; return diff in result instead

      return {
        success: true,
        data: {
          // Provide raw unified diff for summarization
          diff_content: diffRaw,
          files_changed: diffData.stats.total_files,
          additions: diffData.stats.additions,
          deletions: diffData.stats.deletions,
          commit_sha: data.commit_sha,
        },
        metadata: {
          repository: `${data.repository_owner}/${data.repository_name}`,
          commit_sha: data.commit_sha,
          files_processed: diffData.files.length,
        },
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in fetch_diff handler',
        metadata: {
          reason: 'handler_exception',
          errorType: error instanceof Error ? error.constructor.name : 'unknown',
        },
      }
    }
  }

  validate(data: FetchDiffJobData): boolean {
    return !!(
      data.commit_sha &&
      data.repository_owner &&
      data.repository_name &&
      typeof data.commit_sha === 'string' &&
      typeof data.repository_owner === 'string' &&
      typeof data.repository_name === 'string'
    )
  }

  getEstimatedDuration(): number {
    // Most diff fetches complete within 2-5 seconds
    return 5000 // 5 seconds in milliseconds
  }
}

// Factory function for dependency injection
export function createFetchDiffHandler(
  diffService: IDiffService,
  commitService: ICommitService,
  projectService: IProjectService,
  userService: any
): FetchDiffHandler {
  return new FetchDiffHandler(diffService, commitService, projectService, userService)
} 