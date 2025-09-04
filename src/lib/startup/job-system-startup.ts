/**
 * Job System Startup Service
 * 
 * Handles initialization and startup of the job processing system
 * when the Next.js application boots. Manages all dependencies
 * and ensures graceful shutdown.
 */

import { getServiceRoleSupabaseService } from '@/lib/supabase/client'
import { createJobProcessingSystem, PRODUCTION_CONFIG, DEVELOPMENT_CONFIG } from '@/lib/jobs/setup'
import type { JobProcessingSystem } from '@/lib/jobs/setup'

interface StartupLogger {
  info(message: string, meta?: any): void
  warn(message: string, meta?: any): void
  error(message: string, meta?: any): void
  debug(message: string, meta?: any): void
}

// Enhanced logger for startup operations
const startupLogger: StartupLogger = {
  info: (message, meta) => console.log(`🚀 [Startup] ${message}`, meta || ''),
  warn: (message, meta) => console.warn(`⚠️  [Startup] ${message}`, meta || ''),
  error: (message, meta) => console.error(`❌ [Startup] ${message}`, meta || ''),
  debug: (message, meta) => console.debug(`🔍 [Startup] ${message}`, meta || ''),
}

class JobSystemStartup {
  private jobSystem: JobProcessingSystem | null = null
  private isInitialized = false
  private shutdownHandlers: (() => Promise<void>)[] = []

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      startupLogger.warn('Job system already initialized')
      return
    }

    try {
      startupLogger.info('Initializing job processing system...')

      // Validate environment variables
      this.validateEnvironment()

      // Create Supabase service with service role key (server-side only)
      const supabaseService = getServiceRoleSupabaseService()
      
      // Create all dependencies (with proper error handling for missing services)
      const dependencies = await this.createDependencies(supabaseService)

      // Create job processing system
      this.jobSystem = createJobProcessingSystem(dependencies)

      // Configure based on environment
      const config = process.env.NODE_ENV === 'production' 
        ? PRODUCTION_CONFIG 
        : DEVELOPMENT_CONFIG

      this.jobSystem.configure(config)

      startupLogger.info('Job processing system created', {
        environment: process.env.NODE_ENV,
        config: {
          maxConcurrentJobs: config.max_concurrent_jobs,
          retryDelay: config.retry_delay_ms,
          jobTimeout: config.job_timeout_ms
        }
      })

      this.isInitialized = true

    } catch (error) {
      startupLogger.error('Failed to initialize job system', error)
      throw error
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Job system not initialized. Call initialize() first.')
    }

    if (!this.jobSystem) {
      throw new Error('Job system is null')
    }

    try {
      startupLogger.info('Starting job processor...')
      
      // Start the job processing system
      await this.jobSystem.start()
      
      // Set up graceful shutdown handlers
      this.setupShutdownHandlers()

      startupLogger.info('✅ Job processing system started successfully')
      
      // Log initial stats
      const stats = await this.jobSystem.getStats()
      startupLogger.info('Job queue stats', stats)

    } catch (error) {
      startupLogger.error('Failed to start job system', error)
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.jobSystem) {
      startupLogger.warn('Job system not running')
      return
    }

    try {
      startupLogger.info('Stopping job processing system...')
      
      await this.jobSystem.stop()
      this.jobSystem = null
      this.isInitialized = false
      
      startupLogger.info('✅ Job processing system stopped successfully')
      
    } catch (error) {
      startupLogger.error('Error stopping job system', error)
      throw error
    }
  }

  getJobSystem(): JobProcessingSystem | null {
    return this.jobSystem
  }

  isRunning(): boolean {
    return this.jobSystem?.processor.isRunning() || false
  }

  get initialized(): boolean {
    return this.isInitialized
  }

  private validateEnvironment(): void {
    const required = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENAI_API_KEY'
    ]

    const missing = required.filter(key => !process.env[key])
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }

    startupLogger.info('Environment validation passed')
  }

  private async createDependencies(supabaseService: any) {
    startupLogger.info('Creating service dependencies...')

    // Start with basic dependencies that are always available
    const dependencies: any = {
      supabaseClient: supabaseService.client
    }

    try {
      // Use the supabase service directly (it already has all services)
      dependencies.commitService = supabaseService.commits
      dependencies.projectService = supabaseService.projects
      dependencies.userService = supabaseService.users
      startupLogger.debug('✅ Database services connected')
    } catch (error) {
      startupLogger.warn('Failed to connect database services', error)
    }

    try {
      // Create OpenAI client and service
      const { createOpenAIClient } = await import('@/lib/openai/client')
      const { createSummarizationService } = await import('@/lib/openai/summarization-service')
      const openaiClient = createOpenAIClient()
      dependencies.openaiService = createSummarizationService(openaiClient)
      startupLogger.debug('✅ OpenAI service created')
    } catch (error) {
      startupLogger.warn('Failed to create OpenAI service', error)
    }

    // Use null/stub for complex services during startup - handlers will create as needed (per-user OAuth)
    dependencies.githubDiffService = null
    dependencies.githubApiClient = null
    startupLogger.debug('✅ GitHub services set to null (handlers will create per-user using OAuth)')

    // GitHub App installation tokens used directly; no token storage needed

    try {
      // Create webhook service with Supabase client
      const { WebhookProcessingService } = await import('@/lib/github/webhook-processing-service')
      dependencies.webhookService = WebhookProcessingService.createWithDefaults(supabaseService.client)
      startupLogger.debug('✅ Webhook service created')
    } catch (error) {
      startupLogger.warn('Failed to create webhook service', error)
    }

    startupLogger.info('✅ Service dependencies created')
    return dependencies
  }

  private setupShutdownHandlers(): void {
    const gracefulShutdown = async (signal: string) => {
      startupLogger.info(`Received ${signal}. Starting graceful shutdown...`)
      
      try {
        // Run all shutdown handlers
        await Promise.all(this.shutdownHandlers.map(handler => handler()))
        
        // Stop job system
        await this.stop()
        
        startupLogger.info('✅ Graceful shutdown complete')
        // Avoid process.exit in environments that may run on Edge or managed runtimes
        if (typeof process !== 'undefined' && process.exit) {
          try { process.exit(0) } catch {}
        }
      } catch (error) {
        startupLogger.error('Error during shutdown', error)
        if (typeof process !== 'undefined' && process.exit) {
          try { process.exit(1) } catch {}
        }
      }
    }

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
    process.on('uncaughtException', (error) => {
      startupLogger.error('Uncaught exception', error)
      gracefulShutdown('uncaughtException')
    })
    process.on('unhandledRejection', (reason) => {
      startupLogger.error('Unhandled rejection', reason)
      gracefulShutdown('unhandledRejection')
    })

    startupLogger.debug('✅ Shutdown handlers registered')
  }

  addShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler)
  }
}

// Global instance using globalThis for cross-context sharing
declare global {
  var __WINS_COLUMN_JOB_SYSTEM__: JobSystemStartup | undefined
}

function getGlobalJobSystemStartup(): JobSystemStartup | null {
  return globalThis.__WINS_COLUMN_JOB_SYSTEM__ || null
}

function setGlobalJobSystemStartup(startup: JobSystemStartup | null): void {
  if (startup) {
    globalThis.__WINS_COLUMN_JOB_SYSTEM__ = startup
  } else {
    delete globalThis.__WINS_COLUMN_JOB_SYSTEM__
  }
}

export function getJobSystemStartup(): JobSystemStartup {
  let startup = getGlobalJobSystemStartup()
  if (!startup) {
    startup = new JobSystemStartup()
    setGlobalJobSystemStartup(startup)
  }
  return startup
}

export async function initializeJobSystem(): Promise<JobSystemStartup> {
  const startup = getJobSystemStartup()
  if (!startup.initialized) {
    await startup.initialize()
    await startup.start()
  }
  return startup
}

export function getJobSystem(): JobProcessingSystem | null {
  const startup = getGlobalJobSystemStartup()
  return startup?.getJobSystem() || null
}

export function isJobSystemRunning(): boolean {
  const startup = getGlobalJobSystemStartup()
  return startup?.isRunning() || false
} 