import {
  ISupabaseClient,
  DatabaseResult,
  DatabaseResults,
} from '../../types/supabase'

import {
  Job,
  JobDependency,
  CreateJobData,
  UpdateJobData,
  JobFilter,
  JobStatus,
  JobType,
  JobQueueStats,
  IJobQueueService,
  DatabaseJobResult,
  DatabaseJobResults,
} from '../../types/jobs'

export interface IJobService extends IJobQueueService {}

export class JobQueueService implements IJobService {
  constructor(private supabaseClient: ISupabaseClient) {}

  // Job CRUD operations
  async createJob(jobData: CreateJobData): Promise<DatabaseJobResult> {
    try {
      // Validate required fields
      if (!jobData.type) {
        return { data: null, error: new Error('Job type is required') }
      }

      if (!jobData.data) {
        return { data: null, error: new Error('Job data is required') }
      }

      // Set defaults
      const defaultMaxAttempts = 1
      const jobRecord = {
        type: jobData.type,
        priority: jobData.priority || 0,
        data: jobData.data,
        context: jobData.context || {},
        commit_id: jobData.commit_id || null,
        project_id: jobData.project_id || null,
        max_attempts: jobData.max_attempts ?? defaultMaxAttempts,
        scheduled_for: jobData.scheduled_for || new Date().toISOString(),
        expires_at: jobData.expires_at || null,
      }

      // Validate priority range
      if (jobRecord.priority < 0 || jobRecord.priority > 100) {
        return { data: null, error: new Error('Priority must be between 0 and 100') }
      }

      // Validate max_attempts range
      if (jobRecord.max_attempts <= 0 || jobRecord.max_attempts > 10) {
        return { data: null, error: new Error('Max attempts must be between 1 and 10') }
      }

      // Validate date format
      try {
        new Date(jobRecord.scheduled_for)
        if (jobRecord.expires_at) {
          new Date(jobRecord.expires_at)
        }
      } catch {
        return { data: null, error: new Error('Invalid date format') }
      }

      const { data, error } = await this.supabaseClient
        .from('jobs')
        .insert(jobRecord)
        .select()
        .single()

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to create job') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async getJob(jobId: string): Promise<DatabaseJobResult> {
    try {
      if (!jobId?.trim()) {
        return { data: null, error: new Error('Job ID is required') }
      }

      const { data, error } = await this.supabaseClient
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return { data: null, error: new Error('Job not found') }
        }
        return { data: null, error: new Error(error.message || 'Failed to get job') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async updateJob(jobId: string, updates: UpdateJobData): Promise<DatabaseJobResult> {
    try {
      if (!jobId?.trim()) {
        return { data: null, error: new Error('Job ID is required') }
      }

      // Validate status transitions if status is being updated
      if (updates.status) {
        const validStatuses: JobStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled']
        if (!validStatuses.includes(updates.status)) {
          return { data: null, error: new Error('Invalid job status') }
        }
      }

      // Validate priority if being updated
      if (updates.priority !== undefined && (updates.priority < 0 || updates.priority > 100)) {
        return { data: null, error: new Error('Priority must be between 0 and 100') }
      }

      // Validate date formats (skip validation for null values)
      if (updates.started_at && updates.started_at !== null) {
        try {
          new Date(updates.started_at)
        } catch {
          return { data: null, error: new Error('Invalid started_at date format') }
        }
      }

      if (updates.completed_at && updates.completed_at !== null) {
        try {
          new Date(updates.completed_at)
        } catch {
          return { data: null, error: new Error('Invalid completed_at date format') }
        }
      }

      if (updates.retry_after && updates.retry_after !== null) {
        try {
          new Date(updates.retry_after)
        } catch {
          return { data: null, error: new Error('Invalid retry_after date format') }
        }
      }

      // Log the update payload for debugging
      console.log('[JobService] Updating job:', { jobId, updates });

      const { data, error } = await this.supabaseClient
        .from('jobs')
        .update(updates)
        .eq('id', jobId)
        .select()
        .single()

      if (error) {
        console.error('[JobService] Update job error:', { jobId, error, updates });
        if (error.code === 'PGRST116') {
          return { data: null, error: new Error('Job not found') }
        }
        return { data: null, error: new Error(error.message || 'Failed to update job') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async deleteJob(jobId: string): Promise<DatabaseJobResult> {
    try {
      if (!jobId?.trim()) {
        return { data: null, error: new Error('Job ID is required') }
      }

      const { data, error } = await this.supabaseClient
        .from('jobs')
        .delete()
        .eq('id', jobId)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return { data: null, error: new Error('Job not found') }
        }
        return { data: null, error: new Error(error.message || 'Failed to delete job') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  // Job queue operations
  async getReadyJobs(limit = 10): Promise<DatabaseJobResults> {
    try {
      // Use the stored function for efficient dependency-aware job selection
      const { data, error } = await this.supabaseClient
        .rpc('get_ready_jobs', { limit_count: limit })

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to get ready jobs'), count: 0 }
      }

      return { data: data || [], error: null, count: data?.length || 0 }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
        count: 0,
      }
    }
  }

  async getJobsByFilter(filter: JobFilter): Promise<DatabaseJobResults> {
    try {
      let query = this.supabaseClient
        .from('jobs')
        .select('*', { count: 'exact' })

      // Apply filters
      if (filter.status) {
        if (Array.isArray(filter.status)) {
          query = query.in('status', filter.status)
        } else {
          query = query.eq('status', filter.status)
        }
      }

      if (filter.type) {
        if (Array.isArray(filter.type)) {
          query = query.in('type', filter.type)
        } else {
          query = query.eq('type', filter.type)
        }
      }

      if (filter.project_id) {
        query = query.eq('project_id', filter.project_id)
      }

      if (filter.commit_id) {
        query = query.eq('commit_id', filter.commit_id)
      }

      if (filter.priority_min !== undefined) {
        query = query.gte('priority', filter.priority_min)
      }

      if (filter.priority_max !== undefined) {
        query = query.lte('priority', filter.priority_max)
      }

      if (filter.scheduled_after) {
        query = query.gte('scheduled_for', filter.scheduled_after)
      }

      if (filter.scheduled_before) {
        query = query.lte('scheduled_for', filter.scheduled_before)
      }

      if (filter.created_after) {
        query = query.gte('created_at', filter.created_after)
      }

      if (filter.created_before) {
        query = query.lte('created_at', filter.created_before)
      }

      // Default ordering by priority and scheduled time
      query = query.order('priority', { ascending: false })
      query = query.order('scheduled_for', { ascending: true })

      const { data, error, count } = await query

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to filter jobs'), count: 0 }
      }

      return { data: data || [], error: null, count: count || 0 }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
        count: 0,
      }
    }
  }

  async getQueueStats(): Promise<JobQueueStats> {
    try {
      // Get job counts by status
      const { data: statusCounts, error: statusError } = await this.supabaseClient
        .from('jobs')
        .select('status')
        .then(async ({ data, error }: { data: any[] | null, error: any }) => {
          if (error) return { data: null, error }
          
          const counts = {
            total_jobs: data?.length || 0,
            pending_jobs: 0,
            running_jobs: 0,
            completed_jobs: 0,
            failed_jobs: 0,
          }

          data?.forEach((job: any) => {
            switch (job.status) {
              case 'pending':
                counts.pending_jobs++
                break
              case 'running':
                counts.running_jobs++
                break
              case 'completed':
                counts.completed_jobs++
                break
              case 'failed':
                counts.failed_jobs++
                break
            }
          })

          return { data: counts, error: null }
        })

      if (statusError) {
        // Return basic stats if query fails
        return {
          total_jobs: 0,
          pending_jobs: 0,
          running_jobs: 0,
          completed_jobs: 0,
          failed_jobs: 0,
        }
      }

      // Get oldest pending job
      const { data: oldestPendingJob } = await this.supabaseClient
        .from('jobs')
        .select('scheduled_for')
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true })
        .limit(1)
        .single()

      const stats: JobQueueStats = {
        ...statusCounts,
        oldest_pending_job: oldestPendingJob?.scheduled_for || undefined,
      }

      return stats
    } catch (err) {
      // Return default stats on error
      return {
        total_jobs: 0,
        pending_jobs: 0,
        running_jobs: 0,
        completed_jobs: 0,
        failed_jobs: 0,
      }
    }
  }

  // Job dependencies
  async addJobDependency(jobId: string, dependsOnJobId: string): Promise<DatabaseJobResult<JobDependency>> {
    try {
      if (!jobId?.trim() || !dependsOnJobId?.trim()) {
        return { data: null, error: new Error('Both job IDs are required') }
      }

      if (jobId === dependsOnJobId) {
        return { data: null, error: new Error('A job cannot depend on itself') }
      }

      const dependencyData = {
        job_id: jobId,
        depends_on_job_id: dependsOnJobId,
      }

      const { data, error } = await this.supabaseClient
        .from('job_dependencies')
        .insert(dependencyData)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          return { data: null, error: new Error('This job dependency already exists') }
        }
        return { data: null, error: new Error(error.message || 'Failed to add job dependency') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async removeJobDependency(jobId: string, dependsOnJobId: string): Promise<DatabaseJobResult> {
    try {
      if (!jobId?.trim() || !dependsOnJobId?.trim()) {
        return { data: null, error: new Error('Both job IDs are required') }
      }

      const { data, error } = await this.supabaseClient
        .from('job_dependencies')
        .delete()
        .eq('job_id', jobId)
        .eq('depends_on_job_id', dependsOnJobId)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return { data: null, error: new Error('Job dependency not found') }
        }
        return { data: null, error: new Error(error.message || 'Failed to remove job dependency') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async getJobDependencies(jobId: string): Promise<DatabaseJobResults<JobDependency>> {
    try {
      if (!jobId?.trim()) {
        return { data: null, error: new Error('Job ID is required'), count: 0 }
      }

      const { data, error, count } = await this.supabaseClient
        .from('job_dependencies')
        .select('*', { count: 'exact' })
        .eq('job_id', jobId)
        .order('created_at', { ascending: true })

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to get job dependencies'), count: 0 }
      }

      return { data: data || [], error: null, count: count || 0 }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
        count: 0,
      }
    }
  }

  // Job lifecycle
  async markJobAsRunning(jobId: string): Promise<DatabaseJobResult> {
    const updates: UpdateJobData = {
      status: 'running',
      started_at: new Date().toISOString(),
    }
    // Retry transient failures up to 3 times
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await this.updateJob(jobId, updates)
      if (!res.error) return res
      await new Promise(r => setTimeout(r, 200 * (attempt + 1)))
    }
    return this.updateJob(jobId, updates)
  }

  async markJobAsCompleted(jobId: string, result?: any): Promise<DatabaseJobResult> {
    const updates: UpdateJobData = {
      status: 'completed',
      completed_at: new Date().toISOString(),
    }

    if (result) {
      updates.context = { result }
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await this.updateJob(jobId, updates)
      if (!res.error) return res
      await new Promise(r => setTimeout(r, 200 * (attempt + 1)))
    }
    return this.updateJob(jobId, updates)
  }

  async markJobAsFailed(jobId: string, error: string, details?: any): Promise<DatabaseJobResult> {
    try {
      // Get current job to check state
      const jobResult = await this.getJob(jobId)
      if (jobResult.error || !jobResult.data) {
        return jobResult
      }

      const job = jobResult.data
      
      // Use attempts from details if provided (processor already calculated it), otherwise increment
      const newAttempts = details?.attempts !== undefined 
        ? Math.min(details.attempts, job.max_attempts) // Enforce constraint
        : Math.min(job.attempts + 1, job.max_attempts) // Enforce constraint

      const updates: UpdateJobData = {
        status: newAttempts >= job.max_attempts ? 'failed' : 'pending',
        attempts: newAttempts,
        error_message: error,
        error_details: details || null,
        // Clear started_at if resetting to pending, keep it for failed jobs
        started_at: newAttempts >= job.max_attempts ? undefined : null,
      }

      // Set retry delay if not max attempts reached
      if (newAttempts < job.max_attempts) {
        const retryDelayMs = Math.min(1000 * Math.pow(2, newAttempts), 300000) // Exponential backoff, max 5 minutes
        const retryAfter = new Date(Date.now() + retryDelayMs)
        updates.retry_after = retryAfter.toISOString()
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await this.updateJob(jobId, updates)
        if (!res.error) return res
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)))
      }
      return this.updateJob(jobId, updates)
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async scheduleRetry(jobId: string, retryAfter: Date): Promise<DatabaseJobResult> {
    const updates: UpdateJobData = {
      status: 'pending',
      retry_after: retryAfter.toISOString(),
      started_at: null, // Clear started_at when resetting to pending
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await this.updateJob(jobId, updates)
      if (!res.error) return res
      await new Promise(r => setTimeout(r, 200 * (attempt + 1)))
    }
    return this.updateJob(jobId, updates)
  }

  // Cleanup and maintenance
  async cleanupCompletedJobs(daysOld = 30): Promise<number> {
    try {
      const { data, error } = await this.supabaseClient
        .rpc('cleanup_completed_jobs', { days_old: daysOld })

      if (error) {
        console.error('Failed to cleanup completed jobs:', error.message)
        return 0
      }

      return data || 0
    } catch (err) {
      console.error('Failed to cleanup completed jobs:', err)
      return 0
    }
  }

  async cleanupExpiredJobs(): Promise<number> {
    try {
      const { data, error, count } = await this.supabaseClient
        .from('jobs')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id', { count: 'exact' })

      if (error) {
        console.error('Failed to cleanup expired jobs:', error.message)
        return 0
      }

      return count || 0
    } catch (err) {
      console.error('Failed to cleanup expired jobs:', err)
      return 0
    }
  }

  // Identify running jobs that exceeded the timeout window
  async getStaleRunningJobs(timeoutMs: number): Promise<DatabaseJobResults> {
    try {
      const cutoffIso = new Date(Date.now() - timeoutMs).toISOString()
      const { data, error, count } = await this.supabaseClient
        .from('jobs')
        .select('*', { count: 'exact' })
        .eq('status', 'running')
        .lte('started_at', cutoffIso)

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to query stale running jobs'), count: 0 }
      }

      return { data: data || [], error: null, count: count || 0 }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
        count: 0,
      }
    }
  }
}

// Factory function
export function createJobQueueService(supabaseClient: ISupabaseClient): IJobService {
  return new JobQueueService(supabaseClient)
} 
