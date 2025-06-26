import { 
  User, 
  Project, 
  Commit, 
  CreateUserData,
  CreateProjectData,
  CreateCommitData,
  ISupabaseClient 
} from '../../types/supabase'

// Mock data factories
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  github_id: 'testuser',
  access_token: 'token123',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

export const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-123',
  user_id: 'user-123',
  name: 'Test Project',
  repo_name: 'testuser/test-repo',
  provider: 'github',
  webhook_url: 'https://example.com/webhook',
  email_distribution_list: ['test@example.com'],
  public_slug: 'test-project',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

export const createMockCommit = (overrides: Partial<Commit> = {}): Commit => ({
  id: 'commit-123',
  project_id: 'project-123',
  sha: 'abc123def456',
  author: 'Test Author',
  timestamp: '2024-01-01T00:00:00.000Z',
  summary: 'Test commit summary',
  type: 'feature',
  is_published: false,
  email_sent: false,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

// Create data factories for input types
export const createMockUserData = (overrides: Partial<CreateUserData> = {}): CreateUserData => ({
  email: 'test@example.com',
  name: 'Test User',
  github_id: 'testuser',
  access_token: 'token123',
  ...overrides,
})

export const createMockProjectData = (overrides: Partial<CreateProjectData> = {}): CreateProjectData => ({
  name: 'Test Project',
  repo_name: 'testuser/test-repo',
  provider: 'github',
  webhook_url: 'https://example.com/webhook',
  email_distribution_list: ['test@example.com'],
  public_slug: 'test-project',
  user_id: 'user-123',
  ...overrides,
})

export const createMockCommitData = (overrides: Partial<CreateCommitData> = {}): CreateCommitData => ({
  project_id: 'project-123',
  sha: 'abc123def456',
  author: 'Test Author',
  timestamp: '2024-01-01T00:00:00.000Z',
  summary: 'Test commit summary',
  type: 'feature',
  is_published: false,
  email_sent: false,
  ...overrides,
})

// Mock Supabase client factory
export const createMockSupabaseClient = (): jest.Mocked<ISupabaseClient> => {
  const mockQuery = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
  }

  return {
    from: jest.fn().mockReturnValue(mockQuery),
    auth: {},
    storage: {},
  } as jest.Mocked<ISupabaseClient>
}

// Test result helpers
export const createSuccessResult = <T>(data: T) => ({
  data,
  error: null,
})

export const createErrorResult = (message: string) => ({
  data: null,
  error: new Error(message),
})

export const createListResult = <T>(data: T[], count?: number) => ({
  data,
  error: null,
  count: count ?? data.length,
})

// Async test helpers
export const waitFor = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms))

// Database mock setup helpers
export const setupMockQueryChain = (mockClient: jest.Mocked<ISupabaseClient>, result: any) => {
  const mockQuery = mockClient.from('test') as any
  mockQuery.select.mockReturnValue(mockQuery)
  mockQuery.insert.mockReturnValue(mockQuery)
  mockQuery.update.mockReturnValue(mockQuery)
  mockQuery.delete.mockReturnValue(mockQuery)
  mockQuery.eq.mockReturnValue(mockQuery)
  mockQuery.neq.mockReturnValue(mockQuery)
  mockQuery.is.mockReturnValue(mockQuery)
  mockQuery.order.mockReturnValue(mockQuery)
  mockQuery.limit.mockReturnValue(mockQuery)
  mockQuery.range.mockReturnValue(mockQuery)
  mockQuery.gte.mockReturnValue(mockQuery)
  mockQuery.lte.mockReturnValue(mockQuery)
  mockQuery.single.mockResolvedValue(result)
  
  return mockQuery
}

// Test database seeding helpers
export const seedTestUsers = (): User[] => [
  createMockUser({ id: 'user-1', email: 'user1@example.com', name: 'User One' }),
  createMockUser({ id: 'user-2', email: 'user2@example.com', name: 'User Two' }),
]

export const seedTestProjects = (): Project[] => [
  createMockProject({ id: 'project-1', name: 'Project One', user_id: 'user-1' }),
  createMockProject({ id: 'project-2', name: 'Project Two', user_id: 'user-2' }),
]

export const seedTestCommits = (): Commit[] => [
  createMockCommit({ id: 'commit-1', sha: 'abc123', project_id: 'project-1' }),
  createMockCommit({ id: 'commit-2', sha: 'def456', project_id: 'project-1' }),
  createMockCommit({ id: 'commit-3', sha: 'ghi789', project_id: 'project-2' }),
] 