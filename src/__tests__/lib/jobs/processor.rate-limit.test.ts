import { JobProcessor } from '@/lib/jobs/processor'
import type { IJobQueueService, Job } from '@/lib/types/jobs'

describe('JobProcessor rate limit handling', () => {
  const createProcessor = (serviceOverrides?: Partial<IJobQueueService>) => {
    const baseService: Partial<IJobQueueService> = {
      createJob: jest.fn(),
      getJob: jest.fn(),
      updateJob: jest.fn().mockResolvedValue({ data: null, error: null }),
      deleteJob: jest.fn(),
      getReadyJobs: jest.fn(),
      getJobsByFilter: jest.fn(),
      getQueueStats: jest.fn(),
      addJobDependency: jest.fn(),
      removeJobDependency: jest.fn(),
      getJobDependencies: jest.fn(),
      markJobAsRunning: jest.fn(),
      markJobAsCompleted: jest.fn(),
      markJobAsFailed: jest.fn().mockResolvedValue({ data: null, error: null }),
      scheduleRetry: jest.fn().mockResolvedValue({ data: null, error: null }),
      cleanupCompletedJobs: jest.fn(),
      cleanupExpiredJobs: jest.fn(),
      getStaleRunningJobs: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    const jobQueueService = {
      ...baseService,
      ...serviceOverrides,
    } as unknown as IJobQueueService

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }

    return { processor: new JobProcessor(jobQueueService, logger), jobQueueService, logger }
  }

  const buildJob = (overrides?: Partial<Job>): Job => {
    const now = new Date().toISOString()
    return {
      id: 'job-1',
      type: 'fetch_diff',
      status: 'pending',
      priority: 50,
      data: {},
      attempts: 1,
      max_attempts: 3,
      scheduled_for: now,
      created_at: now,
      updated_at: now,
      ...overrides,
    }
  }

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it('schedules retry at GitHub rate limit reset when provided in error message', async () => {
    const now = 1_700_000_000_000
    jest.spyOn(Date, 'now').mockReturnValue(now)

    const resetSeconds = Math.floor(now / 1000) + 600 // 10 minutes later
    const message = `GitHub API rate limit exceeded for getCommitDiff. Resets at: ${resetSeconds}`

    const { processor, jobQueueService } = createProcessor()
    const job = buildJob()

    await (processor as any).handleJobFailure(job, message)

    expect(jobQueueService.scheduleRetry).toHaveBeenCalledTimes(1)
    const scheduledDate = (jobQueueService.scheduleRetry as jest.Mock).mock.calls[0][1] as Date

    const expectedTime = now + (resetSeconds * 1000 - now) + 5000
    expect(scheduledDate.getTime()).toBe(expectedTime)
    expect(jobQueueService.updateJob).toHaveBeenCalledWith(job.id, {
      attempts: 2,
      error_message: message,
      error_details: null,
    })
  })

  it('falls back to exponential backoff when no reset hint is available', async () => {
    const now = 1_700_000_000_000
    jest.spyOn(Date, 'now').mockReturnValue(now)

    const baseDelay = 1000 * Math.pow(2, 1)
    const { processor, jobQueueService } = createProcessor()
    const job = buildJob()

    await (processor as any).handleJobFailure(job, 'Network timeout')

    expect(jobQueueService.scheduleRetry).toHaveBeenCalledTimes(1)
    const scheduledDate = (jobQueueService.scheduleRetry as jest.Mock).mock.calls[0][1] as Date
    expect(scheduledDate.getTime()).toBe(now + Math.min(baseDelay, 30000))
    expect(jobQueueService.updateJob).toHaveBeenCalledWith(job.id, expect.objectContaining({ attempts: 2 }))
  })
})
