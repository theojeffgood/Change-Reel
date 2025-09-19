import {
  ISupabaseClient,
  Project,
  CreateProjectData,
  UpdateProjectData,
  ProjectFilter,
  DatabaseResult,
  DatabaseResults,
  PaginationOptions,
} from '../../types/supabase'

export interface IProjectService {
  getProject(id: string): Promise<DatabaseResult<Project>>
  getProjectBySlug(slug: string): Promise<DatabaseResult<Project>>
  getProjectByRepository(repositoryName: string): Promise<DatabaseResult<Project>>
  createProject(data: CreateProjectData): Promise<DatabaseResult<Project>>
  updateProject(id: string, data: UpdateProjectData): Promise<DatabaseResult<Project>>
  deleteProject(id: string): Promise<DatabaseResult<boolean>>
  listProjects(filter?: ProjectFilter, pagination?: PaginationOptions): Promise<DatabaseResults<Project>>
  getProjectsByUser(userId: string): Promise<DatabaseResults<Project>>
  getProjectByUserId(userId: string): Promise<DatabaseResult<Project>>
  getProjectByUserAndRepository(userId: string, repositoryName: string): Promise<DatabaseResult<Project>>
  getLatestProjectForUser(userId: string): Promise<Project | null>
}

export class ProjectService implements IProjectService {
  constructor(private supabaseClient: ISupabaseClient) {}

  async getProject(id: string): Promise<DatabaseResult<Project>> {
    try {
      const { data, error } = await this.supabaseClient
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to get project') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async getProjectBySlug(slug: string): Promise<DatabaseResult<Project>> {
    try {
      const { data, error } = await this.supabaseClient
        .from('projects')
        .select('*')
        .eq('public_slug', slug)
        .single()

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to get project by slug') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async getProjectByRepository(repositoryName: string): Promise<DatabaseResult<Project>> {
    try {
      const { data, error } = await this.supabaseClient
        .from('projects')
        .select('*')
        .eq('repo_name', repositoryName)
        .single()

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to get project by repository') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async createProject(projectData: CreateProjectData): Promise<DatabaseResult<Project>> {
    try {
      // Validate required fields
      if (!projectData.name?.trim()) {
        return { data: null, error: new Error('Project name is required') }
      }

      if (!projectData.provider) {
        return { data: null, error: new Error('Provider is required') }
      }

      // Validate provider enum
      const validProviders = ['github', 'gitlab', 'bitbucket']
      if (!validProviders.includes(projectData.provider)) {
        return { data: null, error: new Error('Invalid provider. Must be one of: github, gitlab, bitbucket') }
      }

      // Validate public slug format if provided
      if (projectData.public_slug) {
        const slugRegex = /^[a-z0-9\-]+$/
        if (!slugRegex.test(projectData.public_slug)) {
          return { data: null, error: new Error('Public slug must contain only lowercase letters, numbers, and hyphens') }
        }
      }

      // Validate email distribution list
      if (projectData.email_distribution_list) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const invalidEmails = projectData.email_distribution_list.filter(email => !emailRegex.test(email))
        if (invalidEmails.length > 0) {
          return { data: null, error: new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`) }
        }
      }

      // Validate repository name format if provided
      if (projectData.repo_name) {
        const repoRegex = /^[\w\-\.]+\/[\w\-\.]+$/
        if (!repoRegex.test(projectData.repo_name)) {
          return { data: null, error: new Error('Repository name must be in "owner/repository" format') }
        }
      }

      const { data, error } = await this.supabaseClient
        .from('projects')
        .insert(projectData)
        .select()
        .single()

      if (error) {
        // Handle unique constraint violations
        if (error.code === '23505') {
          if (error.message.includes('public_slug')) {
            return { data: null, error: new Error('A project with this public slug already exists') }
          }
        }
        return { data: null, error: new Error(error.message || 'Failed to create project') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async updateProject(id: string, projectData: UpdateProjectData): Promise<DatabaseResult<Project>> {
    try {
      // Validate fields if provided
      if (projectData.name !== undefined && !projectData.name?.trim()) {
        return { data: null, error: new Error('Project name cannot be empty') }
      }

      if (projectData.provider) {
        const validProviders = ['github', 'gitlab', 'bitbucket']
        if (!validProviders.includes(projectData.provider)) {
          return { data: null, error: new Error('Invalid provider. Must be one of: github, gitlab, bitbucket') }
        }
      }

      if (projectData.public_slug) {
        const slugRegex = /^[a-z0-9\-]+$/
        if (!slugRegex.test(projectData.public_slug)) {
          return { data: null, error: new Error('Public slug must contain only lowercase letters, numbers, and hyphens') }
        }
      }

      if (projectData.email_distribution_list) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const invalidEmails = projectData.email_distribution_list.filter(email => !emailRegex.test(email))
        if (invalidEmails.length > 0) {
          return { data: null, error: new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`) }
        }
      }

      if (projectData.repo_name) {
        const repoRegex = /^[\w\-\.]+\/[\w\-\.]+$/
        if (!repoRegex.test(projectData.repo_name)) {
          return { data: null, error: new Error('Repository name must be in "owner/repository" format') }
        }
      }

      const { data, error } = await this.supabaseClient
        .from('projects')
        .update(projectData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          if (error.message.includes('public_slug')) {
            return { data: null, error: new Error('A project with this public slug already exists') }
          }
        }
        return { data: null, error: new Error(error.message || 'Failed to update project') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async deleteProject(id: string): Promise<DatabaseResult<boolean>> {
    try {
      const { error } = await this.supabaseClient
        .from('projects')
        .delete()
        .eq('id', id)

      if (error) {
        return { data: false, error: new Error(error.message || 'Failed to delete project') }
      }

      return { data: true, error: null }
    } catch (err) {
      return {
        data: false,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async listProjects(filter?: ProjectFilter, pagination?: PaginationOptions): Promise<DatabaseResults<Project>> {
    try {
      const limit = pagination?.limit || 50
      const offset = ((pagination?.page || 1) - 1) * limit

      let query = this.supabaseClient
        .from('projects')
        .select('*', { count: 'exact' })

      // Apply filters
      if (filter?.provider) {
        query = query.eq('provider', filter.provider)
      }

      if (filter?.user_id) {
        query = query.eq('user_id', filter.user_id)
      }

      // Apply ordering
      const orderBy = pagination?.orderBy || 'created_at'
      const ascending = pagination?.ascending || false
      query = query.order(orderBy, { ascending })

      // Apply pagination
      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to list projects'), count: 0 }
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

  async getProjectsByUser(userId: string): Promise<DatabaseResults<Project>> {
    try {
      const { data, error, count } = await this.supabaseClient
        .from('projects')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to get projects by user'), count: 0 }
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

  async getProjectByUserId(userId: string): Promise<DatabaseResult<Project>> {
    try {
      const { data, error } = await this.supabaseClient
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return { data: null, error: null }
        }
        return { data: null, error: new Error(error.message || 'Failed to get project by user ID') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async getProjectByUserAndRepository(userId: string, repositoryName: string): Promise<DatabaseResult<Project>> {
    try {
      const { data, error } = await this.supabaseClient
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .eq('repo_name', repositoryName)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return { data: null, error: null }
        }
        return { data: null, error: new Error(error.message || 'Failed to get project by user and repository') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async getLatestProjectForUser(userId: string): Promise<Project | null> {
    try {
      const { data, error } = await this.supabaseClient
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw new Error(error.message || 'Failed to get latest project for user')
      }

      return data ?? null
    } catch (err) {
      if (err instanceof Error && err.message.includes('PGRST116')) {
        return null
      }
      throw err instanceof Error ? err : new Error('Unknown error occurred')
    }
  }
}

// Factory function for dependency injection
export function createProjectService(supabaseClient: ISupabaseClient): IProjectService {
  return new ProjectService(supabaseClient)
} 
