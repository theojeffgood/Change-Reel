import { NextResponse } from 'next/server';
import { getServiceRoleSupabaseService } from '@/lib/supabase/client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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
          // Skip fetch_diff for now - we'll add this when we have proper OAuth tokens
          await supabaseService.jobs.updateJob(job.id, { 
            status: 'completed',
            completed_at: new Date().toISOString()
          });
          processed++;
          
          // Create a simple mock diff for generate_summary jobs to process
          results.push({
            jobId: job.id,
            type: job.type,
            status: 'completed',
            data: { diff_content: 'Mock diff content for testing' }
          });
        } else if (job.type === 'generate_summary') {
          // Generate AI summary using OpenAI
          const result = await processGenerateSummaryJob(job, supabaseService);
          
          if (result.success) {
            await supabaseService.jobs.updateJob(job.id, { 
              status: 'completed',
              completed_at: new Date().toISOString()
            });
            processed++;
            console.log(`✅ Job ${job.id} completed: Generated AI summary`);
            
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
    
    // Only process push events
    if (data.webhook_event !== 'push') {
      return {
        success: true,
        message: 'Ignored non-push event',
        data: { event: data.webhook_event, action: 'ignored' }
      };
    }

    // Extract commits from payload
    const commits = data.payload?.commits || [];
    if (commits.length === 0) {
      return {
        success: true,
        message: 'No commits to process',
        data: { commits_processed: 0 }
      };
    }

    // Get project information (for now, assume we have one project)
    const { data: projects } = await supabaseService.projects.listProjects();
    if (!projects || projects.length === 0) {
      return {
        success: false,
        error: 'No projects found in database'
      };
    }

    const project = projects[0]; // Use first project for MVP
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

        // Create generate_summary job (skip fetch_diff for now)
        const { data: summaryJob, error: summaryJobError } = await supabaseService.jobs.createJob({
          type: 'generate_summary',
          priority: 60,
          data: {
            commit_id: commit.id,
            commit_message: commitData.message,
            author: commitData.author?.name || commitData.author?.email || 'Unknown',
            branch: data.payload.ref?.replace('refs/heads/', '') || 'main',
            diff_content: `Mock diff for commit ${commitData.id}` // Mock diff for now
          },
          commit_id: commit.id,
          project_id: project.id
        });

        if (summaryJob) {
          createdJobs.push(summaryJob.id);
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
    
    let summary = '';
    let changeType = 'chore';

    try {
      // Use OpenAI to generate summary
      const openai = await import('openai');
      const client = new openai.OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const prompt = `You are a changelog assistant. Summarize the following commit into a 1-2 sentence plain English description of what changed. Be concise and skip minor edits.

Commit: ${data.commit_message}
Author: ${data.author}
Branch: ${data.branch}

Provide only the summary, no additional text.`;

      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.3
      });

      summary = completion.choices[0]?.message?.content?.trim() || '';
    } catch (openaiError: any) {
      // Fallback to simple rule-based summary for quota/API errors
      console.log('OpenAI API failed, using fallback summary:', openaiError.message);
      
      const commitMessage = data.commit_message || '';
      const author = data.author || 'Unknown';
      
      // Generate a simple summary based on commit message
      if (commitMessage.toLowerCase().includes('fix')) {
        summary = `Fixed an issue in the codebase (by ${author})`;
        changeType = 'fix';
      } else if (commitMessage.toLowerCase().includes('feat') || commitMessage.toLowerCase().includes('add')) {
        summary = `Added new functionality to the project (by ${author})`;
        changeType = 'feature';
      } else if (commitMessage.toLowerCase().includes('refactor') || commitMessage.toLowerCase().includes('improve')) {
        summary = `Improved code structure and organization (by ${author})`;
        changeType = 'refactor';
      } else {
        summary = `Made changes to ${commitMessage ? commitMessage.split('\n')[0] : 'the codebase'} (by ${author})`;
        changeType = 'chore';
      }
    }
    
    if (!summary) {
      return {
        success: false,
        error: 'No summary generated'
      };
    }

    // Detect change type based on commit message if not already set
    if (changeType === 'chore') {
      const commitMessage = data.commit_message?.toLowerCase() || '';
      if (commitMessage.includes('feat') || commitMessage.includes('add') || commitMessage.includes('new')) {
        changeType = 'feature';
      } else if (commitMessage.includes('fix') || commitMessage.includes('bug')) {
        changeType = 'fix';
      } else if (commitMessage.includes('refactor') || commitMessage.includes('improve')) {
        changeType = 'refactor';
      }
    }

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
        commit_id: data.commit_id
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in summary generation'
    };
  }
} 