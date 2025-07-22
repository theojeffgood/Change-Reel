import { NextResponse } from 'next/server';
import { getServiceRoleSupabaseService } from '@/lib/supabase/client';

export async function POST() {
  try {
    const supabaseService = getServiceRoleSupabaseService();
    
    // Get pending jobs
    const { data: jobs, error } = await supabaseService.jobs.getJobsByFilter({ status: 'pending' });
    
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch jobs', details: error.message }, { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ message: 'No pending jobs to process', processed: 0 });
    }

    console.log(`Found ${jobs.length} pending jobs to process`);
    
    const results = [];
    for (const job of jobs) {
      try {
        console.log(`Processing job ${job.id} of type ${job.type}`);
        
        if (job.type === 'fetch_diff') {
          // For now, just mark as completed with mock data
          await supabaseService.jobs.updateJob(job.id, { 
            status: 'completed',
            completed_at: new Date().toISOString()
          });
          results.push({ jobId: job.id, type: job.type, status: 'completed' });
          console.log(`Marked fetch_diff job ${job.id} as completed`);
        } else if (job.type === 'generate_summary') {
          // For now, just mark as completed with mock summary
          await supabaseService.jobs.updateJob(job.id, { 
            status: 'completed',
            completed_at: new Date().toISOString()
          });
          
          // Update the commit with the mock summary
          if (job.commit_id) {
            await supabaseService.commits.updateCommit(job.commit_id, {
              summary: 'AI-generated summary: This commit includes bug fixes and improvements.',
              type: 'fix'
            });
            console.log(`Updated commit ${job.commit_id} with AI summary`);
          }
          
          results.push({ jobId: job.id, type: job.type, status: 'completed' });
          console.log(`Marked generate_summary job ${job.id} as completed`);
        } else {
          results.push({ jobId: job.id, type: job.type, status: 'skipped', reason: 'unsupported type' });
        }
      } catch (jobError) {
        console.error(`Failed to process job ${job.id}:`, jobError);
        results.push({ 
          jobId: job.id, 
          type: job.type, 
          status: 'failed', 
          error: jobError instanceof Error ? jobError.message : 'Unknown error' 
        });
      }
    }

    return NextResponse.json({
      message: `Processed ${results.length} jobs`,
      processed: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status === 'failed').length,
      results
    });

  } catch (error) {
    console.error('Job processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 