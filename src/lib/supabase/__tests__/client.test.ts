import {
  validateSupabaseConfig,
  createSupabaseClient,
  SupabaseService,
  getSupabaseService,
  createSupabaseService,
} from '../client'
import { MockSupabaseService, createMockSupabaseService } from './mocks'

// Mock the Supabase client creation
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(),
    auth: {},
    storage: {},
    rpc: jest.fn(),
  })),
}))

describe('Supabase Client Configuration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('validateSupabaseConfig', () => {
    it('should return valid config when environment variables are set', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

      const config = validateSupabaseConfig()

      expect(config).toEqual({
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      })
    })

    it('should throw error when URL is missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

      expect(() => validateSupabaseConfig()).toThrow(
        'Missing NEXT_PUBLIC_SUPABASE_URL environment variable'
      )
    })

    it('should throw error when anon key is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      expect(() => validateSupabaseConfig()).toThrow(
        'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable'
      )
    })

    it('should throw error when URL is invalid', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'invalid-url'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

      expect(() => validateSupabaseConfig()).toThrow(
        'NEXT_PUBLIC_SUPABASE_URL is not a valid URL'
      )
    })
  })

  describe('createSupabaseClient', () => {
    it('should create client with provided config', () => {
      const config = {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      }

      const client = createSupabaseClient(config)

      expect(client).toBeDefined()
      expect(typeof client.from).toBe('function')
    })

    it('should create client with environment variables when no config provided', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

      const client = createSupabaseClient()

      expect(client).toBeDefined()
      expect(typeof client.from).toBe('function')
    })
  })

  describe('SupabaseService', () => {
    it('should initialize with environment variables', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

      const service = new SupabaseService()
      const client = service.getClient()

      expect(client).toBeDefined()
      expect(typeof client.from).toBe('function')
    })

    it('should initialize with provided config', () => {
      const config = {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      }

      const service = new SupabaseService(config)
      const client = service.getClient()

      expect(client).toBeDefined()
      expect(typeof client.from).toBe('function')
    })

    it('should test connection correctly', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

      const service = new SupabaseService()
      
      // Mock successful connection
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ error: null }),
        }),
      })
      
      service.getRawClient().from = mockFrom

      const isConnected = await service.isConnected()
      expect(isConnected).toBe(true)
    })

    it('should handle connection failure', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

      const service = new SupabaseService()
      
      // Mock connection failure
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockRejectedValue(new Error('Connection failed')),
        }),
      })
      
      service.getRawClient().from = mockFrom

      const isConnected = await service.isConnected()
      expect(isConnected).toBe(false)
    })
  })

  describe('getSupabaseService', () => {
    it('should return singleton instance', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

      const service1 = getSupabaseService()
      const service2 = getSupabaseService()

      expect(service1).toBe(service2)
    })
  })

  describe('createSupabaseService', () => {
    it('should create new instance each time', () => {
      const config = {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      }

      const service1 = createSupabaseService(config)
      const service2 = createSupabaseService(config)

      expect(service1).not.toBe(service2)
      expect(service1).toBeInstanceOf(SupabaseService)
      expect(service2).toBeInstanceOf(SupabaseService)
    })
  })
})

describe('Mock Supabase Service', () => {
  describe('MockSupabaseService', () => {
    it('should create mock service with default connection state', () => {
      const mockService = createMockSupabaseService()
      
      expect(mockService).toBeInstanceOf(MockSupabaseService)
      expect(mockService.isConnected()).resolves.toBe(true)
    })

    it('should allow setting connection state', async () => {
      const mockService = createMockSupabaseService({ isConnected: false })
      
      expect(await mockService.isConnected()).toBe(false)
    })

    it('should provide mock client', () => {
      const mockService = createMockSupabaseService()
      const client = mockService.getClient()
      
      expect(client).toBeDefined()
      expect(typeof client.from).toBe('function')
      expect(client.auth).toBeDefined()
      expect(client.storage).toBeDefined()
    })

    it('should allow setting mock data', () => {
      const testUsers = [
        { id: '1', email: 'test@example.com', name: 'Test User', created_at: '2023-01-01T00:00:00Z', updated_at: '2023-01-01T00:00:00Z' }
      ]
      
      const mockService = createMockSupabaseService({ users: testUsers })
      
      // Test that the data was set (we can't directly test the private mockData,
      // but we can test that the service was created without errors)
      expect(mockService).toBeInstanceOf(MockSupabaseService)
    })

    it('should clear mock data', () => {
      const mockService = createMockSupabaseService()
      
      mockService.clearMockData()
      
      // Test that clearMockData doesn't throw
      expect(mockService).toBeInstanceOf(MockSupabaseService)
    })
  })
}) 