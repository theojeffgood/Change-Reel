/**
 * Next.js Instrumentation
 * 
 * This file runs when the Next.js server starts up.
 * We use it to initialize and start the job processing system.
 * 
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { initializeJobSystem } from './src/lib/startup/job-system-startup'

export async function register() {
  // Debug logging to understand why instrumentation isn't running
  console.log('🔍 [Instrumentation] register() function called')
  console.log('🔍 [Instrumentation] NEXT_RUNTIME:', process.env.NEXT_RUNTIME)
  console.log('🔍 [Instrumentation] NODE_ENV:', process.env.NODE_ENV)
  console.log('🔍 [Instrumentation] Process environment keys:', Object.keys(process.env).filter(key => key.includes('NEXT')))
  
  // Only run on server-side and in production/development
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      console.log('🚀 [Instrumentation] Starting Wins Column job processing system...')
      
      await initializeJobSystem()
      
      console.log('✅ [Instrumentation] Job processing system started successfully')
    } catch (error) {
      console.error('❌ [Instrumentation] Failed to start job processing system:', error)
      
      // Don't crash the app if job system fails to start
      // Log the error and continue - the app should still serve web requests
      console.error('⚠️  [Instrumentation] Continuing without job processing. Check configuration and restart.')
    }
  } else {
    console.log('⚠️  [Instrumentation] Skipping job system startup - NEXT_RUNTIME is not "nodejs"')
  }
} 