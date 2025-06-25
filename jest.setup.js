require('@testing-library/jest-dom')

// Mock environment variables for testing
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.GITHUB_CLIENT_ID = 'test-github-client-id'
process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret'
process.env.NEXTAUTH_SECRET = 'test-nextauth-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.TOKEN_ENCRYPTION_KEY = 'test-encryption-key-32-characters!'

// Mock NextAuth
jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: null,
    status: 'unauthenticated'
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
  SessionProvider: ({ children }) => children,
}))

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
}))

// Mock crypto for token encryption
Object.defineProperty(global, 'crypto', {
  value: {
    randomBytes: jest.fn(() => Buffer.from('test-random-bytes')),
    createCipheriv: jest.fn(() => ({
      update: jest.fn(() => 'encrypted'),
      final: jest.fn(() => 'final'),
      getAuthTag: jest.fn(() => Buffer.from('auth-tag'))
    })),
    createDecipheriv: jest.fn(() => ({
      setAuthTag: jest.fn(),
      update: jest.fn(() => 'decrypted'),
      final: jest.fn(() => 'final')
    }))
  }
})