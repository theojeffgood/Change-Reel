require('@testing-library/jest-dom');

// Polyfill for TextEncoder/TextDecoder (needed for crypto operations)
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock crypto for Node environment
if (!global.crypto) {
  global.crypto = require('crypto').webcrypto;
}

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.OAUTH_CLIENT_ID = 'test-oauth-client-id'
process.env.OAUTH_CLIENT_SECRET = 'test-oauth-client-secret'
process.env.NEXTAUTH_SECRET = 'test-nextauth-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.TOKEN_ENCRYPTION_KEY = 'test-encryption-key-32-characters!'

// Mock NextAuth
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: null,
    status: 'unauthenticated'
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
  SessionProvider: ({ children }) => children,
  getSession: jest.fn(),
}));

jest.mock('next-auth', () => ({
  default: jest.fn(),
}));

// Mock server-only for tests (Next.js server-only import)
jest.mock('server-only', () => ({}), { virtual: true });

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    })),
    auth: {
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      user: jest.fn()
    },
    storage: {
      from: jest.fn()
    }
  }))
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

// Mock Next.js Request and Response for API route testing
global.Request = class Request {
  constructor(input, init = {}) {
    this.url = typeof input === 'string' ? input : input.url;
    this.method = init.method || 'GET';
    this.headers = new Map(Object.entries(init.headers || {}));
    this.body = init.body || null;
  }
  
  async json() {
    if (this.body) {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
    }
    return {};
  }
  
  async text() {
    return this.body || '';
  }
};

global.Response = class Response {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new Map(Object.entries(init.headers || {}));
    this.ok = this.status >= 200 && this.status < 300;
  }
  
  static json(data, init = {}) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers
      }
    });
  }
  
  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }
  
  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});