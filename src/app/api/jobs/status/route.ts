/**
 * Job Processing Status API
 * 
 * Provides status information about the automatic job processing system.
 * Replaces the manual processing endpoint with status monitoring.
 */

import { NextResponse } from 'next/server'
import { getJobSystem, isJobSystemRunning } from '@/lib/startup/job-system-startup'

export async function GET() {
  try {
    const jobSystem = getJobSystem()
    const isRunning = isJobSystemRunning()

    if (!jobSystem) {
      return NextResponse.json({
        status: 'not_initialized',
        message: 'Job processing system not initialized',
        running: false,
        timestamp: new Date().toISOString()
      }, { status: 503 })
    }

    // Get current job queue statistics
    const stats = await jobSystem.getStats()
    const activeJobs = await jobSystem.getActiveJobs()

    return NextResponse.json({
      status: isRunning ? 'running' : 'stopped',
      message: isRunning 
        ? 'Job processing system is running automatically' 
        : 'Job processing system is stopped',
      running: isRunning,
      known_failure_reasons: {
        finish_reasons: ['stop', 'length', 'content_filter', 'tool_calls'],
        error_codes: [
          'OUTPUT_TOKEN_LIMIT',
          'RATE_LIMIT_EXCEEDED',
          'SERVICE_UNAVAILABLE',
          'TOKEN_LIMIT_EXCEEDED',
          'QUOTA_EXCEEDED',
          'INVALID_REQUEST',
          'AUTHENTICATION_ERROR',
          'API_ERROR',
          'UNKNOWN_ERROR'
        ]
      },
      queue_stats: stats,
      active_jobs: activeJobs,
      active_job_count: activeJobs.length,
      processor_config: jobSystem.processor.getConfiguration(),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to get job system status:', error)
    
    return NextResponse.json({
      status: 'error',
      message: 'Failed to get job system status',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST() {
  try {
    const jobSystem = getJobSystem()
    
    if (!jobSystem) {
      return NextResponse.json({
        success: false,
        message: 'Job processing system not initialized',
        timestamp: new Date().toISOString()
      }, { status: 503 })
    }

    const isRunning = isJobSystemRunning()
    
    if (!isRunning) {
      return NextResponse.json({
        success: false,
        message: 'Job processing system is not running. Check server logs and restart if needed.',
        timestamp: new Date().toISOString()
      }, { status: 503 })
    }

    // Get current stats before and after to show any processing activity
    const statsBefore = await jobSystem.getStats()
    
    // Wait a moment to see if any jobs get processed
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const statsAfter = await jobSystem.getStats()
    const activeJobs = await jobSystem.getActiveJobs()

    return NextResponse.json({
      success: true,
      message: 'Job processing system is running automatically',
      stats_before: statsBefore,
      stats_after: statsAfter,
      active_jobs: activeJobs,
      note: 'Jobs are processed automatically every 2 seconds. No manual intervention needed.',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to check job processing:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Failed to check job processing status',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 
