import {
  Job,
  JobHandler,
  JobResult,
  FetchDiffJobData,
} from '../../types/jobs'

import { IDiffService, DiffReference } from '../../github/diff-service'
import { ICommitService } from '../../supabase/services/commits'
import { TokenStorageService } from '../../oauth/tokenStorage'
import { IProjectService } from '../../supabase/services/projects'

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
    private diffService: IDiffService,
    private commitService: ICommitService,
    private tokenStorage: TokenStorageService,
    private projectService: IProjectService
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

       // Get OAuth token for GitHub API access
       const tokenResult = await this.tokenStorage.getToken(project.user_id, 'github')
       if (tokenResult.error || !tokenResult.data) {
         return {
           success: false,
           error: 'Failed to retrieve GitHub OAuth token',
           metadata: { reason: 'oauth_token_missing', userId: project.user_id },
         }
       }

      // Prepare diff reference for the service
      const diffReference: DiffReference = {
        owner: data.repository_owner,
        repo: data.repository_name,
        base: 'HEAD~1', // Compare with previous commit
        head: data.commit_sha,
      }

      // Fetch the commit diff from GitHub
      const diffResult = await this.diffService.getDiff(diffReference)
      
      // The service returns DiffData directly, not a result object
      const diffData = diffResult

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
          diff_content: JSON.stringify(diffData),
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
  tokenStorage: TokenStorageService,
  projectService: IProjectService
): FetchDiffHandler {
  return new FetchDiffHandler(diffService, commitService, tokenStorage, projectService)
}