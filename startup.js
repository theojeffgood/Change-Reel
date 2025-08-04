/**
 * Job System Startup API
 * 
 * Minimal endpoint that initializes the job processing system on first call.
 * Called by the startup script to ensure job system starts when app starts.
 */

import { NextResponse } from 'next/server'
import { getJobSystem, isJobSystemRunning, initializeJobSystem } from '@/lib/startup/job-system-startup'

let startupAttempted = false

export async function POST() {
  try {
    console.log('🚀 [Startup API] Job system startup requested')
    
    // Check if already running
    const jobSystem = getJobSystem()
    const isRunning = isJobSystemRunning()
    
    if (jobSystem && isRunning) {
      console.log('✅ [Startup API] Job system already running')
      return NextResponse.json({
        success: true,
        message: 'Job processing system already running',
        running: true,
        timestamp: new Date().toISOString()
      })
    }
    
    // Prevent multiple simultaneous startup attempts
    if (startupAttempted) {
      console.log('⚠️  [Startup API] Startup already in progress')
      return NextResponse.json({
        success: false,
        message: 'Job system startup already in progress',
        running: false,
        timestamp: new Date().toISOString()
      }, { status: 409 })
    }
    
    startupAttempted = true
    
    try {
      console.log('🚀 [Startup API] Initializing job processing system...')
      await initializeJobSystem()
      
      const newJobSystem = getJobSystem()
      const newIsRunning = isJobSystemRunning()
      
      console.log('✅ [Startup API] Job processing system started successfully')
      
      return NextResponse.json({
        success: true,
        message: 'Job processing system started successfully',
        running: newIsRunning,
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('❌ [Startup API] Failed to start job system:', error)
      startupAttempted = false // Reset on failure
      
      return NextResponse.json({
        success: false,
        message: 'Failed to start job processing system',
        error: error instanceof Error ? error.message : 'Unknown error',
        running: false,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('❌ [Startup API] Startup endpoint error:', error)
    startupAttempted = false
    
    return NextResponse.json({
      success: false,
      message: 'Startup endpoint error',
      error: error instanceof Error ? error.message : 'Unknown error',
      running: false,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 