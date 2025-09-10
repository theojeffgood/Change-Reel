/**
 * Job Processor Implementation
 * 
 * The central orchestrator for job execution that handles:
 * - Job queue polling and execution
 * - Handler registration and management  
 * - Retry logic and error handling
 * - Concurrent job processing
 * - Status tracking and logging
 */

import {
  Job,
  JobType,
  JobHandler,
  JobResult,
  JobProcessingConfig,
  JobQueueStats,
  IJobProcessor,
  IJobQueueService,
} from '../types/jobs'

interface ProcessorLogger {
  info(message: string, meta?: any): void
  warn(message: string, meta?: any): void
  error(message: string, meta?: any): void
  debug(message: string, meta?: any): void
}

// Default console logger implementation
const defaultLogger: ProcessorLogger = {
  info: (message, meta) => console.log(`[JobProcessor] ${message}`, meta || ''),
  warn: (message, meta) => console.warn(`[JobProcessor] ${message}`, meta || ''),
  error: (message, meta) => console.error(`[JobProcessor] ${message}`, meta || ''),
  debug: (message, meta) => console.debug(`[JobProcessor] ${message}`, meta || ''),
}

export class JobProcessor implements IJobProcessor {
  private handlers: Map<JobType, JobHandler> = new Map()
  private isActive = false
  private processingInterval?: NodeJS.Timeout
  private activeJobs: Set<string> = new Set()
  private config: JobProcessingConfig = {
    max_concurrent_jobs: 5,
    retry_delay_ms: 1000,
    max_retry_delay_ms: 30000,
    exponential_backoff: true,
    job_timeout_ms: 300000, // 5 minutes
    cleanup_completed_after_days: 7,
  }

  constructor(
    private jobQueueService: IJobQueueService,
    private logger: ProcessorLogger = defaultLogger
  ) {}

  // Processor lifecycle
  async start(): Promise<void> {
    if (this.isActive) {
      this.logger.warn('Job processor is already running')
      return
    }

    this.logger.info('Starting job processor')
    this.isActive = true
    
    // Reconcile state on startup - reset orphaned running jobs
    await this.reconcileJobState()
    
    // Start the main processing loop
    this.processingInterval = setInterval(
      () => this.processAvailableJobs(),
      2000 // Poll every 2 seconds
    )

    // Start periodic cleanup
    setInterval(
      () => this.performMaintenance(),
      300000 // Every 5 minutes
    )

    this.logger.info('Job processor started successfully')
  }

  async stop(): Promise<void> {
    if (!this.isActive) {
      this.logger.warn('Job processor is not running')
      return
    }

    this.logger.info('Stopping job processor...')
    this.isActive = false

    // Clear the processing interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = undefined
    }

    // Wait for active jobs to complete (with timeout)
    const maxWaitTime = 30000 // 30 seconds
    const startTime = Date.now()
    
    while (this.activeJobs.size > 0 && (Date.now() - startTime) < maxWaitTime) {
      this.logger.info(`Waiting for ${this.activeJobs.size} active jobs to complete...`)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    if (this.activeJobs.size > 0) {
      this.logger.warn(`Job processor stopped with ${this.activeJobs.size} jobs still active`)
    } else {
      this.logger.info('Job processor stopped successfully')
    }
  }

  isRunning(): boolean {
    return this.isActive
  }

  // Handler management
  registerHandler(handler: JobHandler): void {
    if (!handler.type) {
      throw new Error('Handler must have a type defined')
    }

    if (this.handlers.has(handler.type)) {
      this.logger.warn(`Replacing existing handler for job type: ${handler.type}`)
    }

    this.handlers.set(handler.type, handler)
    this.logger.info(`Registered handler for job type: ${handler.type}`)
  }

  unregisterHandler(type: JobType): void {
    const removed = this.handlers.delete(type)
    if (removed) {
      this.logger.info(`Unregistered handler for job type: ${type}`)
    } else {
      this.logger.warn(`No handler found for job type: ${type}`)
    }
  }

  getHandler(type: JobType): JobHandler | undefined {
    return this.handlers.get(type)
  }

  // Processing configuration
  configure(config: Partial<JobProcessingConfig>): void {
    this.config = { ...this.config, ...config }
    this.logger.info('Job processor configuration updated', this.config)
  }

  getConfiguration(): JobProcessingConfig {
    return { ...this.config }
  }

  // Monitoring
  async getStats(): Promise<JobQueueStats> {
    return this.jobQueueService.getQueueStats()
  }

  async getActiveJobs(): Promise<Job[]> {
    const activeJobIds = Array.from(this.activeJobs)
    const jobs: Job[] = []

    for (const jobId of activeJobIds) {
      const result = await this.jobQueueService.getJob(jobId)
      if (result.data) {
        jobs.push(result.data)
      }
    }

    return jobs
  }

  // Core processing logic
  private async processAvailableJobs(): Promise<void> {
    if (!this.isActive) return

    try {
      // Check if we have capacity for more jobs
      const availableSlots = this.config.max_concurrent_jobs! - this.activeJobs.size
      if (availableSlots <= 0) {
        return
      }

      // Get ready jobs from the queue
      const result = await this.jobQueueService.getReadyJobs(availableSlots)
      if (result.error || !result.data) {
        if (result.error) {
          this.logger.error('Failed to fetch ready jobs', result.error.message)
        }
        return
      }

      // Process each job concurrently: fetch full row first to get attempts/max_attempts/status
      const processingPromises = result.data.map(async (partialJob: any) => {
        const full = await this.jobQueueService.getJob(partialJob.id)
        if (full.data) {
          await this.processJob(full.data)
        } else {
          this.logger.warn('Skipped processing job that could not be loaded', { id: partialJob.id, error: full.error?.message })
        }
      })
      await Promise.allSettled(processingPromises)

    } catch (error) {
      this.logger.error('Error in job processing loop', error)
    }
  }

  private async processJob(job: Job): Promise<void> {
    // Check if job is already being processed
    if (this.activeJobs.has(job.id)) {
      return
    }

    // Add to active jobs
    this.activeJobs.add(job.id)
    
    try {
      this.logger.info(`Starting job ${job.id} (type: ${job.type})`)

      // Mark job as running - critical step, must succeed
      const markRunningResult = await this.jobQueueService.markJobAsRunning(job.id)
      if (markRunningResult.error) {
        throw new Error(`Failed to mark job as running: ${markRunningResult.error.message}`)
      }

      // Get the appropriate handler
      const handler = this.handlers.get(job.type)
      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.type}`)
      }

      // Validate job data if handler supports it
      if (handler.validate && !handler.validate(job.data)) {
        throw new Error('Job data validation failed')
      }

      // Execute the job with timeout
      const result = await this.executeWithTimeout(
        () => handler.handle(job, job.data),
        this.config.job_timeout_ms!
      )

      if (result.success) {
        // Mark job as completed
        await this.jobQueueService.markJobAsCompleted(job.id, result.data)
        this.logger.info(`Job ${job.id} completed successfully`)
      } else {
        // Handle job failure
        await this.handleJobFailure(job, result.error || 'Unknown error', result.metadata)
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.handleJobFailure(job, errorMessage)
    } finally {
      // Remove from active jobs
      this.activeJobs.delete(job.id)
    }
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      operation()
        .then(result => {
          clearTimeout(timeout)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timeout)
          reject(error)
        })
    })
  }

  private async handleJobFailure(job: Job, errorMessage: string, errorDetails?: any): Promise<void> {
    // Enrich logs with structured OpenAI details when available
    const logDetails: any = {
      message: errorMessage,
    }
    if (errorDetails) {
      logDetails.code = errorDetails.error_code || errorDetails.code
      logDetails.finish_reason = errorDetails.finish_reason
      logDetails.tokens = errorDetails.completion_tokens || errorDetails.total_tokens || errorDetails.max_tokens
        ? {
            completion: errorDetails.completion_tokens,
            total: errorDetails.total_tokens,
            max: errorDetails.max_tokens,
          }
        : undefined
      logDetails.model = errorDetails.model
    }
    this.logger.error(`Job ${job.id} failed`, logDetails)

    const msg = (errorMessage || '').toLowerCase()
    const nonRetryable =
      msg.includes('output_token_limit') ||
      msg.includes('finish_reason=length') ||
      msg.includes('no summary generated from openai response')

    if (nonRetryable) {
      await this.jobQueueService.markJobAsFailed(job.id, errorMessage, { attempts: job.attempts, nonRetryable: true, ...(errorDetails || {}) })
      this.logger.error(`Job ${job.id} marked failed (non-retryable)`, logDetails)
      return
    }

    // Check if we should retry
    if (job.attempts < job.max_attempts) {
      // Calculate retry delay
      const retryDelay = this.calculateRetryDelay(job.attempts)
      const retryAfter = new Date(Date.now() + retryDelay)

      // Schedule retry
      await this.jobQueueService.scheduleRetry(job.id, retryAfter)
      // Attach error info for visibility on pending job
      await this.jobQueueService.updateJob(job.id, { error_message: errorMessage, error_details: errorDetails || null })
      this.logger.info(`Job ${job.id} scheduled for retry in ${retryDelay}ms (attempt ${job.attempts + 1}/${job.max_attempts})`, logDetails)
    } else {
      // Mark as permanently failed
      await this.jobQueueService.markJobAsFailed(job.id, errorMessage, { attempts: job.attempts, ...(errorDetails || {}) })
      this.logger.error(`Job ${job.id} permanently failed after ${job.attempts} attempts`, logDetails)
    }
  }

  private calculateRetryDelay(attemptNumber: number): number {
    if (!this.config.exponential_backoff) {
      return this.config.retry_delay_ms!
    }

    // Exponential backoff: base_delay * 2^attempt
    const delay = this.config.retry_delay_ms! * Math.pow(2, attemptNumber)
    return Math.min(delay, this.config.max_retry_delay_ms!)
  }

  /**
   * Reconcile job state on startup - reset orphaned running jobs
   * This fixes sync issues between database and in-memory tracking
   */
  private async reconcileJobState(): Promise<void> {
    try {
      this.logger.info('Reconciling job state on startup...')
      
      // Find all jobs marked as 'running' in database
      const runningJobs = await this.jobQueueService.getStaleRunningJobs(0) // 0ms = get ALL running jobs
      
      if (runningJobs.data && runningJobs.data.length > 0) {
        this.logger.warn(`Found ${runningJobs.data.length} orphaned running jobs from previous session`)
        
        for (const job of runningJobs.data) {
          // Reset to pending with retry logic
          await this.handleJobFailure(job as any, 'Job orphaned on processor restart')
        }
        
        this.logger.info(`Reconciled ${runningJobs.data.length} orphaned jobs`)
      } else {
        this.logger.info('No orphaned jobs found - state is clean')
      }
      
    } catch (error) {
      this.logger.error('Error during job state reconciliation', error)
      // Don't throw - processor should still start
    }
  }

  /**
   * Sync activeJobs set with database to catch any drift
   */
  private async syncActiveJobsWithDatabase(): Promise<void> {
    try {
      // Get all currently running jobs from database
      const dbRunningJobs = await this.jobQueueService.getStaleRunningJobs(0)
      const dbRunningIds = new Set(dbRunningJobs.data?.map(job => job.id) || [])
      
      // Check for jobs in activeJobs that aren't running in DB
      for (const activeId of this.activeJobs) {
        if (!dbRunningIds.has(activeId)) {
          this.logger.warn(`Removing orphaned active job ${activeId} - not running in database`)
          this.activeJobs.delete(activeId)
        }
      }
      
      // Check for jobs running in DB that aren't in activeJobs
      // These should be handled by the main stale job logic, but log for visibility
      const orphanedDbJobs = dbRunningJobs.data?.filter(job => !this.activeJobs.has(job.id)) || []
      if (orphanedDbJobs.length > 0) {
        this.logger.warn(`Found ${orphanedDbJobs.length} jobs running in DB but not tracked in memory`)
      }
      
    } catch (error) {
      this.logger.error('Error during activeJobs sync', error)
    }
  }

  private async performMaintenance(): Promise<void> {
    if (!this.isActive) return

    try {
      this.logger.debug('Running maintenance tasks')

      // Cleanup completed jobs
      const cleanedJobs = await this.jobQueueService.cleanupCompletedJobs(
        this.config.cleanup_completed_after_days
      )

      if (cleanedJobs > 0) {
        this.logger.info(`Cleaned up ${cleanedJobs} completed jobs`)
      }

      // Cleanup expired jobs
      const expiredJobs = await this.jobQueueService.cleanupExpiredJobs()
      if (expiredJobs > 0) {
        this.logger.info(`Cleaned up ${expiredJobs} expired jobs`)
      }

      // Requeue or fail stale running jobs (safety net for stuck states)
      const stale = await this.jobQueueService.getStaleRunningJobs(this.config.job_timeout_ms!)
      if (stale.data && stale.data.length > 0) {
        for (const j of stale.data) {
          // Treat as failure due to timeout; mark failed or schedule retry
          await this.handleJobFailure(j as any, 'Job timed out (maintenance)')
        }
        this.logger.warn(`Reconciled ${stale.data.length} stale running jobs`)
      }

      // Sync activeJobs with database to catch any drift
      await this.syncActiveJobsWithDatabase()

    } catch (error) {
      this.logger.error('Error during maintenance', error)
    }
  }
}

// Factory function for creating job processor
export function createJobProcessor(
  jobQueueService: IJobQueueService,
  logger?: ProcessorLogger
): IJobProcessor {
  return new JobProcessor(jobQueueService, logger)
} 
