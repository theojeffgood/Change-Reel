require('@testing-library/jest-dom');

// Mock environment variables for testing
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.GITHUB_CLIENT_ID = 'test-github-client-id'
process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret'
process.env.NEXTAUTH_SECRET = 'test-nextauth-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.TOKEN_ENCRYPTION_KEY = 'test-encryption-key-32-characters!'

// Mock NextAuth
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: null,
    status: 'unauthenticated'
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
  getSession: jest.fn(),
}));

jest.mock('next-auth', () => ({
  default: jest.fn(),
}));

// Mock crypto for Node.js environment
Object.defineProperty(global, 'crypto', {
  value: {
    randomBytes: jest.fn((size) => Buffer.alloc(size, 'test')),
    createCipher: jest.fn(() => ({
      setAutoPadding: jest.fn(),
      update: jest.fn(() => 'encrypted'),
      final: jest.fn(() => 'data')
    })),
    createDecipher: jest.fn(() => ({
      setAutoPadding: jest.fn(),
      update: jest.fn(() => 'decrypted'),
      final: jest.fn(() => 'data')
    }))
  }
});

// Mock Supabase
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithOAuth: jest.fn(() => Promise.resolve({ data: null, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
  }
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});