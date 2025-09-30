/**
 * Next.js Instrumentation
 * 
 * This file runs when the Next.js server starts up.
 * We use it to initialize and start the job processing system.
 * 
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { initializeJobSystem } from './lib/startup/job-system-startup'

export async function register() {
  // Only run on server-side, and only when explicitly enabled
  const shouldStart = process.env.NEXT_RUNTIME === 'nodejs' && process.env.JOB_SYSTEM_ENABLED === 'true'
  if (!shouldStart) {
    console.log('ℹ️ [Instrumentation] Job processing disabled (set JOB_SYSTEM_ENABLED=true to enable).')
    return
  }

  try {
    console.log('🚀 [Instrumentation] Starting Wins Column job processing system...')
    await initializeJobSystem()
    console.log('✅ [Instrumentation] Job processing system started successfully')
  } catch (error) {
    console.error('❌ [Instrumentation] Failed to start job processing system:', error)
    // Don't crash the app if job system fails to start
    console.error('⚠️  [Instrumentation] Continuing without job processing. Check configuration and restart.')
  }
}
