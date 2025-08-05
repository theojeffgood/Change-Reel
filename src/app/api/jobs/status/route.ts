/**
 * Job Processing Status & Background Processor API
 * 
 * Provides status information and manages automatic background job processing.
 * This API route starts and manages job processing within the Next.js app.
 */

import { NextResponse } from 'next/server'
import { createSupabaseService } from '@/lib/supabase/client'
import { createOpenAIClient } from '@/lib/openai/client'
import { createSummarizationService } from '@/lib/openai/summarization-service'

// Background job processing state
let processingInterval: NodeJS.Timeout | null = null
let isProcessingActive = false
const jobStats = {
  processed: 0,
  failed: 0,
  lastProcessedAt: null as Date | null,
  startedAt: null as Date | null
}

// Background job processor
async function processJobs() {
  if (isProcessingActive) return // Prevent overlapping executions

  isProcessingActive = true
  try {
    const supabase = createSupabaseService()
    
            // Get pending jobs
        const { data: jobs, error } = await supabase.getClient()
          .from('jobs')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(5) // Process up to 5 jobs at a time

    if (error) {
      console.error('Failed to fetch pending jobs:', error)
      return
    }

    if (!jobs || jobs.length === 0) {
      return // No jobs to process
    }

    console.log(`🔄 [JobProcessor] Processing ${jobs.length} jobs...`)

    // Process each job
    for (const job of jobs) {
      try {
        await processJob(job, supabase)
        jobStats.processed++
        jobStats.lastProcessedAt = new Date()
      } catch (error) {
        console.error(`❌ [JobProcessor] Failed to process job ${job.id}:`, error)
        jobStats.failed++
        
                            // Mark job as failed
                    await supabase.getClient()
                      .from('jobs')
                      .update({ 
                        status: 'failed',
                        error_message: error instanceof Error ? error.message : 'Unknown error',
                        completed_at: new Date().toISOString()
                      })
                      .eq('id', job.id)
      }
    }

  } catch (error) {
    console.error('❌ [JobProcessor] Error in job processing cycle:', error)
  } finally {
    isProcessingActive = false
  }
}

// Process individual job based on type
async function processJob(job: any, supabase: any) {
  console.log(`🔄 [JobProcessor] Processing ${job.type} job ${job.id}`)
  
      // Mark job as running
    await supabase.getClient()
      .from('jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job.id)

  switch (job.type) {
    case 'fetch_diff':
      await processFetchDiffJob(job, supabase)
      break
    case 'generate_summary':
      await processGenerateSummaryJob(job, supabase)
      break
    case 'send_email':
      await processSendEmailJob(job, supabase)
      break
    case 'webhook_processing':
      await processWebhookJob(job, supabase)
      break
    default:
      throw new Error(`Unknown job type: ${job.type}`)
  }

      // Mark job as completed
    await supabase.getClient()
      .from('jobs')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', job.id)

  console.log(`✅ [JobProcessor] Completed ${job.type} job ${job.id}`)
}

// Simplified job processors (placeholder implementations)
async function processFetchDiffJob(job: any, supabase: any) {
  // TODO: Implement fetch diff logic
  console.log('Processing fetch diff job:', job.data)
}

async function processGenerateSummaryJob(job: any, supabase: any) {
  // TODO: Implement summary generation with OpenAI
  console.log('Processing summary generation job:', job.data)
}

async function processSendEmailJob(job: any, supabase: any) {
  // TODO: Implement email sending logic
  console.log('Processing send email job:', job.data)
}

async function processWebhookJob(job: any, supabase: any) {
  // TODO: Implement webhook processing logic
  console.log('Processing webhook job:', job.data)
}

export async function GET() {
  try {
    // Start background processing if not already running
    if (!processingInterval) {
      console.log('🚀 [JobProcessor] Starting background job processing...')
      
      processingInterval = setInterval(async () => {
        try {
          await processJobs()
        } catch (error) {
          console.error('❌ [JobProcessor] Error in processing interval:', error)
        }
      }, 2000) // Process every 2 seconds

      jobStats.startedAt = new Date()
      console.log('✅ [JobProcessor] Background processing started')
    }

            // Get current job statistics
        const supabase = createSupabaseService()
        const { data: pendingJobs } = await supabase.getClient()
          .from('jobs')
          .select('count')
          .eq('status', 'pending')
          .single()

        const { data: runningJobs } = await supabase.getClient()
          .from('jobs')
          .select('count')
          .eq('status', 'running')
          .single()

    return NextResponse.json({
      status: 'running',
      message: 'Background job processing is active',
      running: true,
      queue_stats: {
        pending_jobs: pendingJobs?.count || 0,
        running_jobs: runningJobs?.count || 0,
        processed_total: jobStats.processed,
        failed_total: jobStats.failed,
        last_processed_at: jobStats.lastProcessedAt,
        started_at: jobStats.startedAt
      },
      processor_info: {
        interval_ms: 2000,
        currently_processing: isProcessingActive
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [JobProcessor] Failed to get status:', error)
    
    return NextResponse.json({
      status: 'error',
      message: 'Failed to get job processing status',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST() {
  try {
    // Trigger immediate job processing
    if (!processingInterval) {
      return NextResponse.json({
        success: false,
        message: 'Background job processing not started. Call GET first to initialize.',
        timestamp: new Date().toISOString()
      }, { status: 503 })
    }

    // Trigger immediate processing
    await processJobs()

    return NextResponse.json({
      success: true,
      message: 'Immediate job processing triggered',
      note: 'Jobs are processed automatically every 2 seconds. This was a manual trigger.',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to trigger job processing:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Failed to trigger job processing',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 