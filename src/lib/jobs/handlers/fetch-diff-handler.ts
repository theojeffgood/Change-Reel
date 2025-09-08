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
import { createInstallationAccessToken } from '@/lib/github/app-auth'

/**
 * Handler for fetching commit diffs from GitHub API
 * 
 * This handler:
 * 1. Creates an installation access token for GitHub API access
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

      // Get project to retrieve installation information
      if (!job.project_id) {
        return {
          success: false,
          error: 'Project ID is required for GitHub API access',
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

      // Check if project has installation_id for GitHub App access
      if (!project.installation_id) {
        return {
          success: false,
          error: 'Project does not have a GitHub App installation configured',
          metadata: { reason: 'missing_installation_id', projectId: job.project_id },
        }
      }

      // Create installation access token for GitHub API access
      let installationToken: string
      try {
        const tokenResult = await createInstallationAccessToken(project.installation_id)
        installationToken = tokenResult.token
      } catch (error) {
        return {
          success: false,
          error: 'Failed to create GitHub installation access token',
          metadata: { reason: 'installation_token_failed', installationId: project.installation_id, error: error instanceof Error ? error.message : 'Unknown error' },
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

      // Use injected diff service if present; otherwise create per-installation service
      let diffService = this.diffService
      if (!diffService) {
        const apiClient = createGitHubClient({ auth: installationToken })
        diffService = createDiffService(apiClient)
      }

      // Fetch the commit diff from GitHub with intelligent fallback
      let diffData: any = null;
      let diffRaw: string = '';
      
      const fetchDiffWithReference = async (ref: any) => {
        const data = await diffService.getDiff(ref);
        const raw = await diffService.getDiffRaw(ref);
        return { data, raw };
      };

      try {
        const result = await fetchDiffWithReference(diffReference);
        diffData = result.data;
        diffRaw = result.raw;
      } catch (error) {
        // If the base reference doesn't exist, try progressive fallbacks
        if (error instanceof Error && error.message.includes('Not Found')) {
          console.log(`[FetchDiffHandler] Base reference "${diffReference.base}" not found, trying fallbacks for ${diffReference.head}`);
          
          let fallbackWorked = false;
          
          // Try fallbacks in order of preference
          const fallbacks = [
            'HEAD~1',           // Previous commit (different from default if base_sha was provided)
            'HEAD~2',           // Two commits back
            'main',             // Compare against main branch
            'master',           // Compare against master branch
          ];
          
          for (const fallbackBase of fallbacks) {
            // Skip if this is already what we tried
            if (fallbackBase === diffReference.base) continue;
            
            try {
              const fallbackReference = { ...diffReference, base: fallbackBase };
              const result = await fetchDiffWithReference(fallbackReference);
              diffData = result.data;
              diffRaw = result.raw;
              console.log(`[FetchDiffHandler] Successfully used fallback "${fallbackBase}" for ${diffReference.head}`);
              fallbackWorked = true;
              break;
            } catch (fallbackError) {
              console.log(`[FetchDiffHandler] Fallback "${fallbackBase}" also failed, trying next...`);
              continue;
            }
          }
          
          // If all reasonable fallbacks failed, try empty tree as last resort
          if (!fallbackWorked) {
            try {
              const emptyTreeReference = {
                ...diffReference,
                base: '4b825dc642cb6eb9a060e54bf8d69288fbee4904' // Git empty tree
              };
              const result = await fetchDiffWithReference(emptyTreeReference);
              diffData = result.data;
              diffRaw = result.raw;
              console.log(`[FetchDiffHandler] Used empty tree as last resort for ${diffReference.head}`);
            } catch (lastResortError) {
              throw new Error(`Failed to fetch diff for ${diffReference.base}..${diffReference.head}: All fallbacks failed`);
            }
          }
        } else {
          throw new Error(`Failed to fetch diff for ${diffReference.base}..${diffReference.head}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Ensure we have valid diff data before proceeding
      if (!diffData || !diffRaw) {
        throw new Error(`Failed to fetch diff data for ${diffReference.base}..${diffReference.head} - no data received`);
      }

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