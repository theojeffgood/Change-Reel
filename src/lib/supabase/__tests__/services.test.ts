import {
  createSupabaseServices,
  SupabaseServiceProvider,
  UserService,
  ProjectService,
  CommitService,
} from '../services'
import {
  createMockSupabaseClient,
  createMockSupabaseService,
  MockSupabaseService,
} from './mocks'
import type {
  User,
  Project,
  Commit,
  CreateUserData,
  CreateProjectData,
  CreateCommitData,
} from '../../types/supabase'

describe('Supabase Data Access Layer', () => {
  let mockClient: any
  let services: ReturnType<typeof createSupabaseServices>

  beforeEach(() => {
    mockClient = createMockSupabaseClient()
    services = createSupabaseServices(mockClient)
  })

  describe('Service Provider', () => {
    it('should create all services with proper dependencies', () => {
      const provider = new SupabaseServiceProvider(mockClient)
      
      expect(provider.users).toBeInstanceOf(UserService)
      expect(provider.projects).toBeInstanceOf(ProjectService)
      expect(provider.commits).toBeInstanceOf(CommitService)
    })

    it('should provide access to all services', () => {
      const provider = new SupabaseServiceProvider(mockClient)
      const allServices = provider.getAllServices()
      
      expect(allServices.users).toBeDefined()
      expect(allServices.projects).toBeDefined()
      expect(allServices.commits).toBeDefined()
    })
  })

  describe('User Service', () => {
    const sampleUser: User = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    }

    beforeEach(() => {
      mockClient.from().select().eq().single.mockResolvedValue({
        data: sampleUser,
        error: null,
      })
    })

    it('should get user by id', async () => {
      const result = await services.users.getUser('user-1')
      
      expect(result.error).toBeNull()
      expect(result.data).toEqual(sampleUser)
      expect(mockClient.from).toHaveBeenCalledWith('users')
    })

    it('should get user by email', async () => {
      const result = await services.users.getUserByEmail('test@example.com')
      
      expect(result.error).toBeNull()
      expect(result.data).toEqual(sampleUser)
    })

    it('should validate email format when creating user', async () => {
      const invalidUser: CreateUserData = {
        email: 'invalid-email',
        name: 'Test User',
      }
      
      const result = await services.users.createUser(invalidUser)
      
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('Invalid email format')
    })

    it('should create user with valid data', async () => {
      mockClient.from().insert().select().single.mockResolvedValue({
        data: sampleUser,
        error: null,
      })
      
      const userData: CreateUserData = {
        email: 'test@example.com',
        name: 'Test User',
      }
      
      const result = await services.users.createUser(userData)
      
      expect(result.error).toBeNull()
      expect(result.data).toEqual(sampleUser)
    })

    it('should handle database errors gracefully', async () => {
      mockClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })
      
      const result = await services.users.getUser('user-1')
      
      expect(result.error).not.toBeNull()
      expect(result.data).toBeNull()
    })
  })

  describe('Project Service', () => {
    const sampleProject: Project = {
      id: 'project-1',
      name: 'Test Project',
      provider: 'github',
      email_distribution_list: ['test@example.com'],
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    }

    beforeEach(() => {
      mockClient.from().select().eq().single.mockResolvedValue({
        data: sampleProject,
        error: null,
      })
    })

    it('should get project by id', async () => {
      const result = await services.projects.getProject('project-1')
      
      expect(result.error).toBeNull()
      expect(result.data).toEqual(sampleProject)
      expect(mockClient.from).toHaveBeenCalledWith('projects')
    })

    it('should validate provider when creating project', async () => {
      const invalidProject: CreateProjectData = {
        name: 'Test Project',
        provider: 'invalid-provider' as any,
        email_distribution_list: [],
      }
      
      const result = await services.projects.createProject(invalidProject)
      
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('Invalid provider')
    })

    it('should validate email distribution list', async () => {
      const invalidProject: CreateProjectData = {
        name: 'Test Project',
        provider: 'github',
        email_distribution_list: ['invalid-email', 'test@example.com'],
      }
      
      const result = await services.projects.createProject(invalidProject)
      
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('Invalid email addresses')
    })

    it('should create project with valid data', async () => {
      mockClient.from().insert().select().single.mockResolvedValue({
        data: sampleProject,
        error: null,
      })
      
      const projectData: CreateProjectData = {
        name: 'Test Project',
        provider: 'github',
        email_distribution_list: ['test@example.com'],
      }
      
      const result = await services.projects.createProject(projectData)
      
      expect(result.error).toBeNull()
      expect(result.data).toEqual(sampleProject)
    })

    it('should validate repository name format', async () => {
      const invalidProject: CreateProjectData = {
        name: 'Test Project',
        provider: 'github',
        repo_name: 'invalid-repo-name',
        email_distribution_list: [],
      }
      
      const result = await services.projects.createProject(invalidProject)
      
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('owner/repository')
    })
  })

  describe('Commit Service', () => {
    const sampleCommit: Commit = {
      id: 'commit-1',
      project_id: 'project-1',
      sha: 'abc123def456',
      author: 'test@example.com',
      timestamp: '2023-01-01T00:00:00Z',
      summary: 'Test commit summary',
      type: 'feature',
      is_published: false,
      email_sent: false,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    }

    beforeEach(() => {
      mockClient.from().select().eq().single.mockResolvedValue({
        data: sampleCommit,
        error: null,
      })
    })

    it('should get commit by id', async () => {
      const result = await services.commits.getCommit('commit-1')
      
      expect(result.error).toBeNull()
      expect(result.data).toEqual(sampleCommit)
      expect(mockClient.from).toHaveBeenCalledWith('commits')
    })

    it('should get commit by SHA and project', async () => {
      const result = await services.commits.getCommitBySha('project-1', 'abc123def456')
      
      expect(result.error).toBeNull()
      expect(result.data).toEqual(sampleCommit)
    })

    it('should validate SHA format when creating commit', async () => {
      const invalidCommit: CreateCommitData = {
        project_id: 'project-1',
        sha: 'invalid-sha',
        author: 'test@example.com',
        timestamp: '2023-01-01T00:00:00Z',
      }
      
      const result = await services.commits.createCommit(invalidCommit)
      
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('Invalid SHA format')
    })

    it('should validate commit type', async () => {
      const invalidCommit: CreateCommitData = {
        project_id: 'project-1',
        sha: 'abc123def456',
        author: 'test@example.com',
        timestamp: '2023-01-01T00:00:00Z',
        type: 'invalid-type' as any,
      }
      
      const result = await services.commits.createCommit(invalidCommit)
      
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('Invalid commit type')
    })

    it('should create commit with valid data', async () => {
      mockClient.from().insert().select().single.mockResolvedValue({
        data: sampleCommit,
        error: null,
      })
      
      const commitData: CreateCommitData = {
        project_id: 'project-1',
        sha: 'abc123def456',
        author: 'test@example.com',
        timestamp: '2023-01-01T00:00:00Z',
      }
      
      const result = await services.commits.createCommit(commitData)
      
      expect(result.error).toBeNull()
      expect(result.data).toEqual(sampleCommit)
    })

    it('should get published commits for project', async () => {
      mockClient.from().select().eq().eq().order().limit.mockResolvedValue({
        data: [sampleCommit],
        error: null,
        count: 1,
      })
      
      const result = await services.commits.getPublishedCommits('project-1')
      
      expect(result.error).toBeNull()
      expect(result.data).toEqual([sampleCommit])
      expect(result.count).toBe(1)
    })

    it('should get unprocessed commits for project', async () => {
      mockClient.from().select().eq().is().order().limit.mockResolvedValue({
        data: [sampleCommit],
        error: null,
        count: 1,
      })
      
      const result = await services.commits.getUnprocessedCommits('project-1')
      
      expect(result.error).toBeNull()
      expect(result.data).toEqual([sampleCommit])
    })

    it('should mark commit as email sent', async () => {
      mockClient.from().update().eq().select().single.mockResolvedValue({
        data: { ...sampleCommit, email_sent: true },
        error: null,
      })
      
      const result = await services.commits.markCommitAsEmailSent('commit-1')
      
      expect(result.error).toBeNull()
      expect(result.data?.email_sent).toBe(true)
    })

    it('should publish commit', async () => {
      mockClient.from().update().eq().select().single.mockResolvedValue({
        data: { ...sampleCommit, is_published: true },
        error: null,
      })
      
      const result = await services.commits.publishCommit('commit-1')
      
      expect(result.error).toBeNull()
      expect(result.data?.is_published).toBe(true)
    })

    it('should get commits by author', async () => {
      mockClient.from().select().eq().eq().order().limit.mockResolvedValue({
        data: [sampleCommit],
        error: null,
        count: 1,
      })
      
      const result = await services.commits.getCommitsByAuthor('project-1', 'test@example.com')
      
      expect(result.error).toBeNull()
      expect(result.data).toEqual([sampleCommit])
    })

    it('should validate commit type for filtering', async () => {
      const result = await services.commits.getCommitsByType('project-1', 'invalid-type')
      
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('Invalid commit type')
    })

    it('should get commits by date range', async () => {
      mockClient.from().select().eq().gte().lte().order.mockResolvedValue({
        data: [sampleCommit],
        error: null,
        count: 1,
      })
      
      const result = await services.commits.getCommitsByDateRange(
        'project-1',
        '2023-01-01T00:00:00Z',
        '2023-01-02T00:00:00Z'
      )
      
      expect(result.error).toBeNull()
      expect(result.data).toEqual([sampleCommit])
    })

    it('should validate date format for date range query', async () => {
      const result = await services.commits.getCommitsByDateRange(
        'project-1',
        'invalid-date',
        '2023-01-02T00:00:00Z'
      )
      
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('Invalid date format')
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockClient.from().select().eq().single.mockRejectedValue(new Error('Network error'))
      
      const result = await services.users.getUser('user-1')
      
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toBe('Network error')
      expect(result.data).toBeNull()
    })

    it('should handle unknown errors gracefully', async () => {
      mockClient.from().select().eq().single.mockRejectedValue('Unknown error')
      
      const result = await services.users.getUser('user-1')
      
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toBe('Unknown error occurred')
      expect(result.data).toBeNull()
    })

    it('should handle Supabase constraint violations', async () => {
      mockClient.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      })
      
      const userData: CreateUserData = {
        email: 'test@example.com',
        name: 'Test User',
      }
      
      const result = await services.users.createUser(userData)
      
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('already exists')
    })
  })
}) 