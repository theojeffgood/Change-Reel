import { NextResponse } from 'next/server';
import { getServiceRoleSupabaseService } from '@/lib/supabase/client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createOpenAIClient } from '@/lib/openai/client';
import { createSummarizationService, SummarizationService } from '@/lib/openai/summarization-service';
import { OpenAIError } from '@/lib/openai/error-handler';
import { createCommitWorkflow } from '@/lib/jobs/setup';
import { GenerateSummaryHandler } from '@/lib/jobs/handlers/generate-summary-handler';
import { FetchDiffHandler } from '@/lib/jobs/handlers/fetch-diff-handler';
import { FetchDiffJobData, GenerateSummaryJobData } from '@/lib/types/jobs';

let summarizationService: SummarizationService | null = null;

function getSummarizationService(): SummarizationService {
  if (!summarizationService) {
    const client = createOpenAIClient();
    summarizationService = createSummarizationService(client);
  }
  return summarizationService;
}

export async function POST() {
  try {
    // Create Supabase client
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const supabaseService = getServiceRoleSupabaseService();

    // Get pending jobs
    const { data: jobs, error } = await supabaseService.jobs.getJobsByFilter({ status: 'pending' });
    
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch jobs', details: error.message }, { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ message: 'No pending jobs to process', processed: 0 });
    }

    console.log(`🔄 Processing ${jobs.length} pending jobs`);
    
    const results = [];
    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        console.log(`🔄 Processing job ${job.id} of type ${job.type}`);

        // Mark job as running
        await supabaseService.jobs.updateJob(job.id, { 
          status: 'running',
          started_at: new Date().toISOString()
        });

        if (job.type === 'webhook_processing') {
          // Process webhook job - create commits and subsequent jobs
          const result = await processWebhookJob(job, supabaseService);
          
          if (result.success) {
            await supabaseService.jobs.updateJob(job.id, { 
              status: 'completed',
              completed_at: new Date().toISOString()
            });
            processed++;
            console.log(`✅ Job ${job.id} completed: ${result.message}`);
            
            results.push({
              jobId: job.id,
              type: job.type,
              status: 'completed',
              data: result.data
            });
          } else {
            await supabaseService.jobs.updateJob(job.id, { 
              status: 'failed',
              error_message: result.error,
              completed_at: new Date().toISOString()
            });
            failed++;
            console.log(`❌ Job ${job.id} failed: ${result.error}`);
            
            results.push({
              jobId: job.id,
              type: job.type,
              status: 'failed',
              error: result.error
            });
          }
        } else if (job.type === 'fetch_diff') {
          // Use standard handler to ensure identical data/metadata
          const handler = new FetchDiffHandler(
            null,
            supabaseService.commits,
            supabaseService.projects,
            supabaseService.users
          );
          const result = await handler.handle(job as any, job.data as FetchDiffJobData);
          if (result.success) {
            await supabaseService.jobs.markJobAsCompleted(job.id, result);
            processed++;
            results.push({ jobId: job.id, type: job.type, status: 'completed', data: result.data, metadata: result.metadata });
          } else {
            await supabaseService.jobs.markJobAsFailed(job.id, result.error || 'fetch_diff failed', result.metadata);
            failed++;
            results.push({ jobId: job.id, type: job.type, status: 'failed', error: result.error, metadata: result.metadata });
          }
        } else if (job.type === 'generate_summary') {
          // Use standard handler for identical summaries/metadata
          const handler = new GenerateSummaryHandler(
            getSummarizationService(),
            supabaseService.commits,
            supabaseService.jobs,
            supabaseService.getClient()
          );
          const result = await handler.handle(job as any, job.data as GenerateSummaryJobData);
          
          if (result.success) {
            await supabaseService.jobs.markJobAsCompleted(job.id, result);
            processed++;
            console.log(`✅ Job ${job.id} completed: Generated AI summary`);
            
            results.push({
              jobId: job.id,
              type: job.type,
              status: 'completed',
              data: result.data,
              metadata: result.metadata
            });
          } else {
            await supabaseService.jobs.markJobAsFailed(job.id, result.error || 'generate_summary failed', result.metadata);
            failed++;
            console.log(`❌ Job ${job.id} failed: ${result.error}`);
            results.push({ jobId: job.id, type: job.type, status: 'failed', error: result.error, metadata: result.metadata });
          }
        } else {
          // Unsupported job type
          console.log(`❌ No handler for job type: ${job.type}`);
          results.push({
            jobId: job.id,
            type: job.type,
            status: 'skipped',
            reason: 'unsupported type'
          });
        }

      } catch (error) {
        // Handle unexpected errors
        await supabaseService.jobs.updateJob(job.id, { 
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString()
        });
        
        failed++;
        console.log(`💥 Job ${job.id} threw error:`, error);
        
        results.push({
          jobId: job.id,
          type: job.type,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      message: `Processed ${jobs.length} jobs`,
      processed,
      failed,
      results
    });

  } catch (error) {
    console.error('Job processor error:', error);
    return NextResponse.json({
      error: 'Job processor failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function processWebhookJob(job: any, supabaseService: any): Promise<{ success: boolean; message?: string; data?: any; error?: string }> {
  try {
    const data = job.data;
    
    // Handle GitHub App installation event (initial backfill)
    if (data.webhook_event === 'installation') {
      const payload = data.payload || {};
      const action = payload.action;
      if (action !== 'created') {
        return {
          success: true,
          message: `Ignored installation action '${action}'`,
          data: { event: 'installation', action }
        };
      }
      const installationId: number | undefined = payload.installation?.id;
      const senderId: number | undefined = payload.sender?.id;
      if (!installationId) {
        return { success: false, error: 'installation event missing installation id' };
      }
      const { runInstallationBackfill } = await import('@/lib/github/installation-backfill');
      const res = await runInstallationBackfill(
        {
          jobs: supabaseService.jobs,
          commits: supabaseService.commits,
          projects: supabaseService.projects,
          users: supabaseService.users,
        },
        installationId,
        senderId
      );
      return {
        success: true,
        message: `Installation backfill: processed ${res.commits_processed} commits, created ${res.jobs_created} jobs`,
        data: res
      };
    }

    // Only process push events
    if (data.webhook_event !== 'push') {
      return {
        success: true,
        message: 'Ignored non-push event',
        data: { event: data.webhook_event, action: 'ignored' }
      };
    }

    // Extract repository and commits from payload
    const repositoryFullName: string | undefined = data.payload?.repository?.full_name;
    const commits = data.payload?.commits || [];
    if (commits.length === 0) {
      return {
        success: true,
        message: 'No commits to process',
        data: { commits_processed: 0 }
      };
    }

    // Resolve project for this repository
    if (!repositoryFullName) {
      return {
        success: true,
        message: 'No repository in payload; ignored',
        data: { commits_processed: 0 }
      };
    }

    const { data: project, error: projectError } = await supabaseService.projects.getProjectByRepository(repositoryFullName);
    if (projectError) {
      return { success: false, error: `Project lookup failed: ${projectError.message}` };
    }
    if (!project) {
      return {
        success: true,
        message: `Repository ${repositoryFullName} not registered; ignored`,
        data: { commits_processed: 0 }
      };
    }
    if ((project as any).is_tracked === false) {
      return {
        success: true,
        message: `Repository ${repositoryFullName} is untracked; ignored`,
        data: { commits_processed: 0 }
      };
    }
    const createdCommits = [];
    const createdJobs = [];

    // Process each commit
    for (const commitData of commits) {
      // Create commit record
      const { data: commit, error: commitError } = await supabaseService.commits.createCommit({
        project_id: project.id,
        sha: commitData.id,
        author: commitData.author?.name || commitData.author?.email || 'Unknown',
        timestamp: commitData.timestamp,
        is_published: false,
        email_sent: false
      });

      if (commitError) {
        // Skip if commit already exists
        if (commitError.message?.includes('already exists')) {
          continue;
        }
        console.error('Failed to create commit:', commitError);
        continue;
      }

      if (commit) {
        createdCommits.push(commit.id);

        // Enqueue standard workflow: fetch_diff -> generate_summary
        const [owner, repoName] = repositoryFullName.split('/');
        try {
          const workflow = await createCommitWorkflow(
            supabaseService.jobs,
            commit.id,
            project.id,
            owner,
            repoName,
            commitData.id,
            {
              commit_message: commitData.message,
              author: commitData.author?.name || commitData.author?.email || 'Unknown',
              branch: data.payload.ref?.replace('refs/heads/', '') || 'main',
            }
          );
          if (workflow?.jobs?.length) {
            for (const j of workflow.jobs) {
              if (j?.id) createdJobs.push(j.id);
            }
          }
        } catch (wfErr) {
          console.warn('[push] failed to create workflow for commit', commitData.id, (wfErr as any)?.message || wfErr);
        }
      }
    }

    return {
      success: true,
      message: `Processed ${createdCommits.length} commits, created ${createdJobs.length} jobs`,
      data: {
        commits_processed: createdCommits.length,
        jobs_created: createdJobs.length,
        commit_ids: createdCommits,
        job_ids: createdJobs
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in webhook processing'
    };
  }
}

async function processGenerateSummaryJob(job: any, supabaseService: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const data = job.data;
    
    const diffContent = data.diff_content && data.diff_content.trim().length
      ? data.diff_content
      : `Commit message: ${data.commit_message || '(not provided)'}\nBranch: ${data.branch || '(unknown)'}`;

    const contextLines = [] as string[];
    if (data.author) {
      contextLines.push(`Author: ${data.author}`);
    }
    if (data.commit_message) {
      contextLines.push(`Commit message: ${data.commit_message}`);
    }
    if (data.branch) {
      contextLines.push(`Branch: ${data.branch}`);
    }

    const context = contextLines.length ? contextLines.join('\n') : undefined;

    const service = getSummarizationService();
    const summaryResult = await service.processDiff(diffContent, {
      customContext: context,
    });

    const summary = summaryResult.summary?.trim();

    if (!summary) {
      return {
        success: false,
        error: 'OpenAI returned empty response - no summary generated'
      };
    }

    const changeType = summaryResult.changeType;

    // Update commit with summary
    const { error: updateError } = await supabaseService.commits.updateCommit(data.commit_id, {
      summary: summary,
      type: changeType
    });

    if (updateError) {
      return {
        success: false,
        error: `Failed to update commit: ${updateError.message}`
      };
    }

    return {
      success: true,
      data: {
        summary: summary,
        change_type: changeType,
        commit_id: data.commit_id,
        confidence: summaryResult.confidence,
        metadata: summaryResult.metadata,
      }
    };
  } catch (error: any) {
    // Categorize OpenAI errors for better handling
    let errorType = 'unknown_error';
    let errorMessage = error.message || 'Unknown error in summary generation';
    
    if (error instanceof OpenAIError) {
      switch (error.code) {
        case 'RATE_LIMIT_EXCEEDED':
          errorType = 'rate_limit_exceeded';
          errorMessage = `OpenAI rate limit exceeded: ${error.message}`;
          break;
        case 'AUTHENTICATION_ERROR':
          errorType = 'api_key_invalid';
          errorMessage = `OpenAI API key invalid: ${error.message}`;
          break;
        case 'INVALID_REQUEST':
          errorType = 'invalid_request';
          errorMessage = `Invalid OpenAI request: ${error.message}`;
          break;
        case 'SERVICE_UNAVAILABLE':
          errorType = 'openai_server_error';
          errorMessage = `OpenAI server error: ${error.message}`;
          break;
        case 'NETWORK_ERROR':
          errorType = 'network_error';
          errorMessage = `Network error connecting to OpenAI: ${error.message}`;
          break;
        case 'TOKEN_LIMIT_EXCEEDED':
          errorType = 'token_limit_exceeded';
          errorMessage = `OpenAI token limit exceeded: ${error.message}`;
          break;
        case 'QUOTA_EXCEEDED':
          errorType = 'quota_exceeded';
          errorMessage = `OpenAI quota exceeded: ${error.message}`;
          break;
        default:
          errorType = `openai_error_${error.code.toLowerCase()}`;
          errorMessage = `OpenAI error (${error.code}): ${error.message}`;
      }
    } else if (error?.status === 429) {
      errorType = 'rate_limit_exceeded';
      errorMessage = `OpenAI rate limit exceeded: ${error.message}`;
    } else if (error?.status === 401) {
      errorType = 'api_key_invalid';
      errorMessage = `OpenAI API key invalid: ${error.message}`;
    } else if (error?.status === 403) {
      errorType = 'permission_denied';
      errorMessage = `OpenAI permission denied: ${error.message}`;
    } else if (error?.status >= 500) {
      errorType = 'openai_server_error';
      errorMessage = `OpenAI server error: ${error.message}`;
    } else if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
      errorType = 'network_error';
      errorMessage = `Network error connecting to OpenAI: ${error.message}`;
    }

    console.error('❌ OpenAI summarization failed', {
      jobId: job?.id,
      commitId: job?.data?.commit_id,
      errorType,
      errorMessage,
      code: (error as any)?.code,
      status: (error as any)?.status,
      details: error instanceof OpenAIError ? (error as any).details : undefined,
    });
    
    return {
      success: false,
      error: `${errorType}: ${errorMessage}`
    };
  }
} 
