import {
  ISupabaseClient,
  Commit,
  CreateCommitData,
  UpdateCommitData,
  CommitFilter,
  DatabaseResult,
  DatabaseResults,
  PaginationOptions,
} from '../../types/supabase'

export interface ICommitService {
  getCommit(id: string): Promise<DatabaseResult<Commit>>
  getCommitBySha(projectId: string, sha: string): Promise<DatabaseResult<Commit>>
  createCommit(data: CreateCommitData): Promise<DatabaseResult<Commit>>
  updateCommit(id: string, data: UpdateCommitData): Promise<DatabaseResult<Commit>>
  deleteCommit(id: string): Promise<DatabaseResult<boolean>>
  listCommits(filter?: CommitFilter, pagination?: PaginationOptions): Promise<DatabaseResults<Commit>>
  
  // MVP-specific methods for core functionality
  getPublishedCommits(projectId: string, limit?: number): Promise<DatabaseResults<Commit>>
  getUnprocessedCommits(projectId: string, limit?: number): Promise<DatabaseResults<Commit>>
  getCommitsForEmail(projectId: string, limit?: number): Promise<DatabaseResults<Commit>>
  markCommitAsEmailSent(id: string): Promise<DatabaseResult<Commit>>
  publishCommit(id: string): Promise<DatabaseResult<Commit>>
  unpublishCommit(id: string): Promise<DatabaseResult<Commit>>
  getCommitsByAuthor(projectId: string, author: string, limit?: number): Promise<DatabaseResults<Commit>>
  getCommitsByType(projectId: string, type: string, limit?: number): Promise<DatabaseResults<Commit>>
  getCommitsByDateRange(projectId: string, startDate: string, endDate: string): Promise<DatabaseResults<Commit>>
  getCommitsByProjectId(projectId: string, page: number, pageSize: number): Promise<DatabaseResult<{ commits: Commit[]; count: number }>>
}

export class CommitService implements ICommitService {
  constructor(private supabaseClient: ISupabaseClient) {}

  async getCommit(id: string): Promise<DatabaseResult<Commit>> {
    try {
      const { data, error } = await this.supabaseClient
        .from('commits')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to get commit') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async getCommitBySha(projectId: string, sha: string): Promise<DatabaseResult<Commit>> {
    try {
      const { data, error } = await this.supabaseClient
        .from('commits')
        .select('*')
        .eq('project_id', projectId)
        .eq('sha', sha)
        .single()

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to get commit by SHA') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async createCommit(commitData: CreateCommitData): Promise<DatabaseResult<Commit>> {
    try {
      // Validate required fields
      if (!commitData.project_id) {
        return { data: null, error: new Error('Project ID is required') }
      }

      if (!commitData.sha?.trim()) {
        return { data: null, error: new Error('Commit SHA is required') }
      }

      if (!commitData.author?.trim()) {
        return { data: null, error: new Error('Author is required') }
      }

      if (!commitData.timestamp) {
        return { data: null, error: new Error('Timestamp is required') }
      }

      // Validate SHA format
      const shaRegex = /^[a-f0-9]{7,40}$/
      if (!shaRegex.test(commitData.sha)) {
        return { data: null, error: new Error('Invalid SHA format. Must be 7-40 hexadecimal characters') }
      }

      // Validate type if provided
      if (commitData.type) {
        const validTypes = ['feature', 'bugfix']
        if (!validTypes.includes(commitData.type)) {
          return { data: null, error: new Error('Invalid commit type. Must be one of: feature, bugfix') }
        }
      }

      // Validate timestamp format
      try {
        new Date(commitData.timestamp)
      } catch {
        return { data: null, error: new Error('Invalid timestamp format') }
      }

      const { data, error } = await this.supabaseClient
        .from('commits')
        .insert(commitData)
        .select()
        .single()

      if (error) {
        // Handle unique constraint violations
        if (error.code === '23505') {
          return { data: null, error: new Error('A commit with this SHA already exists for this project') }
        }
        return { data: null, error: new Error(error.message || 'Failed to create commit') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async updateCommit(id: string, commitData: UpdateCommitData): Promise<DatabaseResult<Commit>> {
    try {
      // Validate type if provided
      if (commitData.type) {
        const validTypes = ['feature', 'bugfix']
        if (!validTypes.includes(commitData.type)) {
          return { data: null, error: new Error('Invalid commit type. Must be one of: feature, bugfix') }
        }
      }

      const { data, error } = await this.supabaseClient
        .from('commits')
        .update(commitData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to update commit') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async deleteCommit(id: string): Promise<DatabaseResult<boolean>> {
    try {
      const { error } = await this.supabaseClient
        .from('commits')
        .delete()
        .eq('id', id)

      if (error) {
        return { data: false, error: new Error(error.message || 'Failed to delete commit') }
      }

      return { data: true, error: null }
    } catch (err) {
      return {
        data: false,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async listCommits(filter?: CommitFilter, pagination?: PaginationOptions): Promise<DatabaseResults<Commit>> {
    try {
      const limit = pagination?.limit || 50
      const offset = ((pagination?.page || 1) - 1) * limit

      let query = this.supabaseClient
        .from('commits')
        .select('*', { count: 'exact' })

      // Apply filters
      if (filter?.project_id) {
        query = query.eq('project_id', filter.project_id)
      }

      if (filter?.author) {
        query = query.eq('author', filter.author)
      }

      if (filter?.type) {
        query = query.eq('type', filter.type)
      }

      if (filter?.is_published !== undefined) {
        query = query.eq('is_published', filter.is_published)
      }

      if (filter?.email_sent !== undefined) {
        query = query.eq('email_sent', filter.email_sent)
      }

      if (filter?.date_from) {
        query = query.gte('timestamp', filter.date_from)
      }

      if (filter?.date_to) {
        query = query.lte('timestamp', filter.date_to)
      }

      // Apply ordering
      const orderBy = pagination?.orderBy || 'timestamp'
      const ascending = pagination?.ascending || false
      query = query.order(orderBy, { ascending })

      // Apply pagination
      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to list commits'), count: 0 }
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

  // MVP-specific methods

  async getPublishedCommits(projectId: string, limit = 50): Promise<DatabaseResults<Commit>> {
    try {
      const { data, error, count } = await this.supabaseClient
        .from('commits')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId)
        .eq('is_published', true)
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to get published commits'), count: 0 }
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

  async getUnprocessedCommits(projectId: string, limit = 50): Promise<DatabaseResults<Commit>> {
    try {
      const { data, error, count } = await this.supabaseClient
        .from('commits')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId)
        .is('summary', null)
        .order('timestamp', { ascending: true }) // Process oldest first
        .limit(limit)

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to get unprocessed commits'), count: 0 }
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

  async getCommitsForEmail(projectId: string, limit = 50): Promise<DatabaseResults<Commit>> {
    try {
      const { data, error, count } = await this.supabaseClient
        .from('commits')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId)
        .eq('is_published', true)
        .eq('email_sent', false)
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to get commits for email'), count: 0 }
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

  async markCommitAsEmailSent(id: string): Promise<DatabaseResult<Commit>> {
    return this.updateCommit(id, { email_sent: true })
  }

  async publishCommit(id: string): Promise<DatabaseResult<Commit>> {
    return this.updateCommit(id, { is_published: true })
  }

  async unpublishCommit(id: string): Promise<DatabaseResult<Commit>> {
    return this.updateCommit(id, { is_published: false })
  }

  async getCommitsByAuthor(projectId: string, author: string, limit = 50): Promise<DatabaseResults<Commit>> {
    try {
      const { data, error, count } = await this.supabaseClient
        .from('commits')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId)
        .eq('author', author)
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to get commits by author'), count: 0 }
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

  async getCommitsByType(projectId: string, type: string, limit = 50): Promise<DatabaseResults<Commit>> {
    try {
      const validTypes = ['feature', 'bugfix']
      if (!validTypes.includes(type)) {
        return {
          data: null,
          error: new Error('Invalid commit type. Must be one of: feature, bugfix'),
          count: 0,
        }
      }

      const { data, error, count } = await this.supabaseClient
        .from('commits')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId)
        .eq('type', type)
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to get commits by type'), count: 0 }
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

  async getCommitsByDateRange(projectId: string, startDate: string, endDate: string): Promise<DatabaseResults<Commit>> {
    try {
      // Validate dates
      try {
        new Date(startDate)
        new Date(endDate)
      } catch {
        return {
          data: null,
          error: new Error('Invalid date format'),
          count: 0,
        }
      }

      const { data, error, count } = await this.supabaseClient
        .from('commits')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId)
        .gte('timestamp', startDate)
        .lte('timestamp', endDate)
        .order('timestamp', { ascending: false })

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to get commits by date range'), count: 0 }
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

  async getCommitsByProjectId(
    projectId: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<DatabaseResult<{ commits: Commit[]; count: number }>> {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await this.supabaseClient
        .from('commits')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId)
        .not('summary', 'is', null) // Only get processed commits
        .order('timestamp', { ascending: false })
        .range(from, to);

      if (error) {
        return { data: null, error: new Error(error.message) };
      }
      return { data: { commits: data || [], count: count || 0 }, error: null };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      };
    }
  }
}

// Factory function for dependency injection
export function createCommitService(supabaseClient: ISupabaseClient): ICommitService {
  return new CommitService(supabaseClient)
} 