import { ISupabaseClient, ISupabaseService, User, Project, Commit } from '../../types/supabase'

/**
 * Mock Supabase client for testing
 */
export class MockSupabaseClient implements ISupabaseClient {
  private mockData: {
    users: User[]
    projects: Project[]
    commits: Commit[]
  } = {
    users: [],
    projects: [],
    commits: [],
  }

  from(table: string) {
    return {
      select: (columns?: string) => ({
        eq: (column: string, value: any) => ({
          single: () => this.mockSingleResult(table, column, value),
          limit: (count: number) => this.mockMultipleResults(table, count),
        }),
        limit: (count: number) => this.mockMultipleResults(table, count),
      }),
      insert: (data: any) => ({
        select: () => ({
          single: () => this.mockInsert(table, data),
        }),
      }),
      update: (data: any) => ({
        eq: (column: string, value: any) => ({
          select: () => ({
            single: () => this.mockUpdate(table, column, value, data),
          }),
        }),
      }),
      delete: () => ({
        eq: (column: string, value: any) => ({
          select: () => ({
            single: () => this.mockDelete(table, column, value),
          }),
        }),
      }),
    }
  }

  auth = {
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    signInWithOAuth: () => Promise.resolve({ data: { url: null, provider: null }, error: null }),
    signOut: () => Promise.resolve({ error: null }),
  }

  storage = {
    from: (bucket: string) => ({
      upload: () => Promise.resolve({ data: null, error: null }),
      download: () => Promise.resolve({ data: null, error: null }),
    }),
  }

  private async mockSingleResult(table: string, column: string, value: any) {
    const data = this.getTableData(table)
    const result = data.find((item: any) => item[column] === value)
    return Promise.resolve({ data: result || null, error: null })
  }

  private async mockMultipleResults(table: string, count?: number) {
    const data = this.getTableData(table)
    const result = count ? data.slice(0, count) : data
    return Promise.resolve({ data: result, error: null })
  }

  private async mockInsert(table: string, insertData: any) {
    const newItem = {
      ...insertData,
      id: `mock-id-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    const data = this.getTableData(table)
    data.push(newItem)
    
    return Promise.resolve({ data: newItem, error: null })
  }

  private async mockUpdate(table: string, column: string, value: any, updateData: any) {
    const data = this.getTableData(table)
    const index = data.findIndex((item: any) => item[column] === value)
    
    if (index !== -1) {
      data[index] = {
        ...data[index],
        ...updateData,
        updated_at: new Date().toISOString(),
      }
      return Promise.resolve({ data: data[index], error: null })
    }
    
    return Promise.resolve({ data: null, error: null })
  }

  private async mockDelete(table: string, column: string, value: any) {
    const data = this.getTableData(table)
    const index = data.findIndex((item: any) => item[column] === value)
    
    if (index !== -1) {
      const deleted = data.splice(index, 1)[0]
      return Promise.resolve({ data: deleted, error: null })
    }
    
    return Promise.resolve({ data: null, error: null })
  }

  private getTableData(table: string): any[] {
    switch (table) {
      case 'users':
        return this.mockData.users
      case 'projects':
        return this.mockData.projects
      case 'commits':
        return this.mockData.commits
      default:
        return []
    }
  }

  // Test utilities
  setMockData(table: string, data: any[]) {
    switch (table) {
      case 'users':
        this.mockData.users = data
        break
      case 'projects':
        this.mockData.projects = data
        break
      case 'commits':
        this.mockData.commits = data
        break
    }
  }

  clearMockData() {
    this.mockData = {
      users: [],
      projects: [],
      commits: [],
    }
  }
}

/**
 * Mock Supabase service for testing
 */
export class MockSupabaseService implements ISupabaseService {
  private mockClient: MockSupabaseClient
  private isConnectedValue: boolean = true

  constructor() {
    this.mockClient = new MockSupabaseClient()
  }

  getClient(): ISupabaseClient {
    return this.mockClient
  }

  async isConnected(): Promise<boolean> {
    return this.isConnectedValue
  }

  async testConnection(): Promise<boolean> {
    return this.isConnectedValue
  }

  // Test utilities
  setConnected(connected: boolean) {
    this.isConnectedValue = connected
  }

  setMockData(table: string, data: any[]) {
    this.mockClient.setMockData(table, data)
  }

  clearMockData() {
    this.mockClient.clearMockData()
  }
}

/**
 * Test fixtures
 */
export const createTestUser = (overrides: Partial<User> = {}): User => ({
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  ...overrides,
})

export const createTestProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'test-project-1',
  name: 'Test Project',
  provider: 'github',
  webhook_url: 'https://example.com/webhook',
  email_distribution_list: ['test@example.com'],
  user_id: 'test-user-1',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  ...overrides,
})

export const createTestCommit = (overrides: Partial<Commit> = {}): Commit => ({
  id: 'test-commit-1',
  sha: 'abc123',
  author: 'Test Author',
  timestamp: '2023-01-01T00:00:00Z',
  summary: 'Test commit summary',
  type: 'feature',
  is_published: false,
  email_sent: false,
  project_id: 'test-project-1',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  ...overrides,
})

/**
 * Factory for creating mock Supabase service with test data
 */
export function createMockSupabaseClient(): any {
  // Create a chainable mock that supports all Supabase query builder methods
  const createChainableMock = (): any => {
    const chain: any = {}
    
    // Query builder methods (return chain for chaining)
    const chainMethods = [
      'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 
      'is', 'in', 'contains', 'containedBy', 'order', 'limit', 'offset', 'range'
    ]
    
    chainMethods.forEach((method: string) => {
      chain[method] = jest.fn(() => chain)
    })
    
    // Terminal methods (return promises that can be mocked)
    const terminalMethods = ['single', 'maybeSingle']
    terminalMethods.forEach((method: string) => {
      chain[method] = jest.fn(() => Promise.resolve({ data: null, error: null }))
      // Add mockResolvedValue support
      chain[method].mockResolvedValue = jest.fn((value: any) => {
        chain[method].mockImplementation(() => Promise.resolve(value))
        return chain[method]
      })
    })
    
    // Special handling for methods that can be both chainable and terminal
    // Make limit and order also promise-like when used as terminal operations
    const dualMethods = ['limit', 'order']
    dualMethods.forEach((method: string) => {
      const originalMethod = chain[method]
      
      // Make them thenable for direct promise usage
      Object.assign(originalMethod, {
        then: jest.fn((resolve: any) => resolve({ data: [], error: null, count: 0 })),
        catch: jest.fn(() => originalMethod),
        finally: jest.fn(() => originalMethod),
        mockResolvedValue: jest.fn((value: any) => {
          originalMethod.then = jest.fn((resolve: any) => resolve(value))
          return originalMethod
        }),
      })
    })
    
    // Insert operations
    chain.insert = jest.fn((data: any) => {
      const insertChain = createChainableMock()
      insertChain.select = jest.fn(() => {
        const selectChain = createChainableMock()
        selectChain.single = jest.fn(() => Promise.resolve({ data: null, error: null }))
        selectChain.single.mockResolvedValue = jest.fn((value: any) => {
          selectChain.single.mockImplementation(() => Promise.resolve(value))
          return selectChain.single
        })
        return selectChain
      })
      return insertChain
    })
    
    // Update operations
    chain.update = jest.fn((data: any) => {
      const updateChain = createChainableMock()
      updateChain.eq = jest.fn(() => {
        const eqChain = createChainableMock()
        eqChain.select = jest.fn(() => {
          const selectChain = createChainableMock()
          selectChain.single = jest.fn(() => Promise.resolve({ data: null, error: null }))
          selectChain.single.mockResolvedValue = jest.fn((value: any) => {
            selectChain.single.mockImplementation(() => Promise.resolve(value))
            return selectChain.single
          })
          return selectChain
        })
        return eqChain
      })
      return updateChain
    })
    
    // Delete operations
    chain.delete = jest.fn(() => {
      const deleteChain = createChainableMock()
      deleteChain.eq = jest.fn(() => Promise.resolve({ error: null }))
      deleteChain.eq.mockResolvedValue = jest.fn((value: any) => {
        deleteChain.eq.mockImplementation(() => Promise.resolve(value))
        return deleteChain.eq
      })
      return deleteChain
    })
    
    return chain
  }

  const mockClient = {
    from: jest.fn(() => createChainableMock()),
    
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signInWithOAuth: jest.fn(() => Promise.resolve({ data: { url: null, provider: null }, error: null })),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
    },
    
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ data: null, error: null })),
        download: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    },
  }

  return mockClient
}

export function createMockSupabaseService(options: {
  users?: User[]
  projects?: Project[]
  commits?: Commit[]
  isConnected?: boolean
} = {}): MockSupabaseService {
  const service = new MockSupabaseService()
  
  if (options.users) {
    service.setMockData('users', options.users)
  }
  if (options.projects) {
    service.setMockData('projects', options.projects)
  }
  if (options.commits) {
    service.setMockData('commits', options.commits)
  }
  if (options.isConnected !== undefined) {
    service.setConnected(options.isConnected)
  }
  
  return service
} 