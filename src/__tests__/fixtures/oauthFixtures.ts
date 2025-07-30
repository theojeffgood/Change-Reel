/**
 * Test fixtures for OAuth authentication scenarios
 * 
 * This file contains mock data for testing OAuth flows, GitHub API responses,
 * and various authentication states for comprehensive test coverage.
 */

import { Session } from 'next-auth';

// OAuth Token Fixtures
export const mockOAuthTokens = {
  valid: {
    access_token: 'ghp_test_token_1234567890abcdef',
    token_type: 'bearer',
    scope: 'repo,write:repo_hook,user:email',
    expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  },
  expired: {
    access_token: 'ghp_test_expired_token',
    token_type: 'bearer',
    scope: 'repo,write:repo_hook,user:email',
    expires_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  },
  invalid: {
    access_token: 'invalid_token',
    token_type: 'bearer',
    scope: 'repo',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }
};

// NextAuth Session Fixtures
export const mockSessions = {
  authenticated: {
    user: {
      id: 'github_user_123',
      name: 'Test User',
      email: 'test@example.com',
      image: 'https://github.com/testuser.png',
    },
    accessToken: 'ghp_test_token_1234567890abcdef',
    expires: new Date(Date.now() + 3600 * 1000).toISOString(),
  } as Session,
  unauthenticated: null,
  expired: {
    user: {
      id: 'github_user_123',
      name: 'Test User',
      email: 'test@example.com',
    },
    accessToken: 'ghp_test_expired_token',
    expires: new Date(Date.now() - 3600 * 1000).toISOString(),
  } as Session,
};

// GitHub Repository Fixtures
export const mockRepositories = {
  public: {
    id: 123456789,
    name: 'test-repo',
    full_name: 'testuser/test-repo',
    private: false,
    description: 'A test repository',
    html_url: 'https://github.com/testuser/test-repo',
    permissions: {
      admin: true,
      push: true,
      pull: true,
    },
  },
  private: {
    id: 987654321,
    name: 'private-repo',
    full_name: 'testuser/private-repo',
    private: true,
    description: 'A private test repository',
    html_url: 'https://github.com/testuser/private-repo',
    permissions: {
      admin: false,
      push: true,
      pull: true,
    },
  },
  noAccess: {
    id: 555666777,
    name: 'no-access-repo',
    full_name: 'otheruser/no-access-repo',
    private: true,
    description: 'Repository with no access',
    html_url: 'https://github.com/otheruser/no-access-repo',
    permissions: {
      admin: false,
      push: false,
      pull: false,
    },
  },
};

// GitHub API Response Fixtures
export const mockGitHubAPIResponses = {
  repositories: [mockRepositories.public, mockRepositories.private],
  user: {
    id: 123456,
    login: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    avatar_url: 'https://github.com/testuser.png',
  },
  repositoryDetails: {
    success: mockRepositories.public,
    notFound: null,
    forbidden: null,
  },
  webhooks: {
    existing: [
      {
        id: 12345,
        name: 'web',
        active: true,
        events: ['push'],
        config: {
          url: 'https://example.com/webhooks/github',
          content_type: 'json',
          insecure_ssl: '0',
        },
      },
    ],
    empty: [],
  },
};

// OAuth Validation Fixtures
export const mockValidationInputs = {
  validGitHubUrl: 'https://github.com/testuser/test-repo',
  invalidGitHubUrls: [
    'https://gitlab.com/testuser/test-repo',
    'not-a-url',
    'https://github.com/',
    'https://github.com/user',
  ],
  validEmails: ['test@example.com', 'user.name+tag@domain.co.uk'],
  invalidEmails: ['invalid-email', '@domain.com', 'user@', 'user@domain'],
  validTokens: ['ghp_1234567890abcdef', 'github_pat_1234567890abcdef'],
  invalidTokens: ['invalid_token', 'ghp_short', ''],
};

// Configuration Form Fixtures
export const mockConfigurationData = {
  valid: {
    repositoryUrl: 'https://github.com/testuser/test-repo',
    selectedRepository: mockRepositories.public,
    emailRecipients: ['dev@company.com', 'pm@company.com'],
  },
  invalid: {
    repositoryUrl: 'https://gitlab.com/testuser/test-repo',
    selectedRepository: null,
    emailRecipients: ['invalid-email'],
  },
  empty: {
    repositoryUrl: '',
    selectedRepository: null,
    emailRecipients: [],
  },
};

// API Error Response Fixtures
export const mockAPIErrors = {
  unauthorized: {
    status: 401,
    message: 'Unauthorized',
    documentation_url: 'https://docs.github.com',
  },
  forbidden: {
    status: 403,
    message: 'Forbidden',
    documentation_url: 'https://docs.github.com',
  },
  notFound: {
    status: 404,
    message: 'Not Found',
    documentation_url: 'https://docs.github.com',
  },
  rateLimited: {
    status: 429,
    message: 'API rate limit exceeded',
    documentation_url: 'https://docs.github.com',
  },
  serverError: {
    status: 500,
    message: 'Internal Server Error',
  },
};

// Token Storage Fixtures
export const mockTokenStorageData = {
  encrypted: {
    encrypted_token: 'encrypted_token_data',
    iv: 'initialization_vector',
    auth_tag: 'authentication_tag',
    token_version: 1,
  },
  decrypted: {
    access_token: 'ghp_test_token_1234567890abcdef',
    token_type: 'bearer',
    scope: 'repo,write:repo_hook,user:email',
  },
};

// Test Helper Functions
export const createMockSession = (overrides: Partial<Session> = {}): Session => ({
  ...mockSessions.authenticated,
  ...overrides,
});

export const createMockRepository = (overrides: any = {}) => ({
  ...mockRepositories.public,
  ...overrides,
});

export const createMockAPIError = (status: number, message: string) => ({
  status,
  message,
  documentation_url: 'https://docs.github.com',
});

// MSW (Mock Service Worker) Handlers for API Testing
export const mockFetch = {
  success: (data: any) => 
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    }),
  error: (status: number, message: string) =>
    Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve({ message }),
    }),
};

// Mock OAuth configuration data
export const mockOAuthConfigurations = {
  validConfiguration: {
    repositoryFullName: 'testuser/test-repo',
    emailRecipients: ['dev@example.com', 'pm@example.com'],
  },
  configurationWithInvalidEmails: {
    repositoryFullName: 'testuser/test-repo',
    emailRecipients: ['invalid-email', 'dev@example.com', 'duplicate@example.com', 'duplicate@example.com'],
  },
  configurationWithInvalidRepository: {
    repositoryFullName: 'invalid/repository/format',
    emailRecipients: ['dev@example.com'],
  },
  emptyConfiguration: {
    repositoryFullName: '',
    emailRecipients: [],
  },
  largeConfiguration: {
    repositoryFullName: 'testuser/test-repo',
    emailRecipients: Array.from({ length: 15 }, (_, i) => `user${i + 1}@example.com`),
  },
};

// Mock database records
export const mockDatabaseRecords = {
  storedOAuthToken: {
    id: 'token-uuid-1234',
    user_id: '12345678',
    encrypted_token: 'encrypted_token_data_here',
    iv: 'initialization_vector_hex',
    auth_tag: 'authentication_tag_hex',
    provider: 'github',
    scopes: ['repo', 'write:repo_hook', 'user:email'],
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_used_at: new Date().toISOString(),
    token_version: 1,
  },
  expiredOAuthToken: {
    id: 'token-uuid-5678',
    user_id: '12345678',
    encrypted_token: 'encrypted_expired_token_data',
    iv: 'initialization_vector_hex_2',
    auth_tag: 'authentication_tag_hex_2',
    provider: 'github',
    scopes: ['repo', 'user:email'],
    expires_at: new Date(Date.now() - 3600000).toISOString(), // Expired
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    last_used_at: new Date(Date.now() - 3600000).toISOString(),
    token_version: 1,
  },
  securityAuditLogs: [
    {
      hashed_user_id: 'hashed_user_id_123',
      action: 'token_stored',
      provider: 'github',
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0 (Test Browser)',
      success: true,
      timestamp: new Date().toISOString(),
    },
    {
      hashed_user_id: 'hashed_user_id_123',
      action: 'token_retrieved',
      provider: 'github',
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0 (Test Browser)',
      success: true,
      timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
    },
    {
      hashed_user_id: 'hashed_user_id_456',
      action: 'token_retrieved',
      provider: 'github',
      ip_address: '192.168.1.200',
      user_agent: 'Mozilla/5.0 (Test Browser)',
      success: false,
      error_message: 'Token expired',
      timestamp: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
    },
  ],
};

// Mock webhook payloads
export const mockWebhookPayloads = {
  pushEvent: {
    ref: 'refs/heads/main',
    before: 'abc123def456',
    after: 'def456ghi789',
    repository: mockGitHubAPIResponses.repositoryDetails,
    pusher: {
      name: 'testuser',
      email: 'test@example.com',
    },
    commits: [
      {
        id: 'def456ghi789',
        message: 'Add new feature for user authentication',
        author: {
          name: 'Test User',
          email: 'test@example.com',
        },
        timestamp: new Date().toISOString(),
        url: 'https://github.com/testuser/test-repo/commit/def456ghi789',
        added: ['src/auth/login.ts'],
        modified: ['src/auth/index.ts', 'package.json'],
        removed: [],
      },
    ],
    head_commit: {
      id: 'def456ghi789',
      message: 'Add new feature for user authentication',
      author: {
        name: 'Test User',
        email: 'test@example.com',
      },
      timestamp: new Date().toISOString(),
      url: 'https://github.com/testuser/test-repo/commit/def456ghi789',
    },
  },
  pullRequestEvent: {
    action: 'opened',
    number: 42,
    pull_request: {
      id: 888999000,
      number: 42,
      title: 'Add OAuth integration',
      body: 'This PR adds OAuth integration for better security',
      state: 'open',
      user: {
        login: 'testuser',
        id: 12345678,
      },
      head: {
        ref: 'feature/oauth',
        sha: 'ghi789jkl012',
      },
      base: {
        ref: 'main',
        sha: 'def456ghi789',
      },
    },
    repository: mockGitHubAPIResponses.repositoryDetails,
  },
};

// Mock NextAuth.js provider responses
export const mockNextAuthProviders = {
  github: {
    id: 'github',
    name: 'GitHub',
    type: 'oauth',
    signinUrl: 'http://localhost:3000/api/auth/signin/github',
    callbackUrl: 'http://localhost:3000/api/auth/callback/github',
  },
};

// Mock environment variables for testing
export const mockEnvironmentVariables = {
  valid: {
    OAUTH_CLIENT_ID: 'oauth_client_id_12345',
    OAUTH_CLIENT_SECRET: 'oauth_client_secret_67890',
    NEXTAUTH_SECRET: 'nextauth_secret_abcdef123456',
    NEXTAUTH_URL: 'http://localhost:3000',
    TOKEN_ENCRYPTION_KEY: 'change-reel-secure-encryption-key-2024-v1-production-grade!!',
  },
  missing: {
    // OAUTH_CLIENT_ID is missing
    OAUTH_CLIENT_SECRET: 'oauth_client_secret_67890',
    NEXTAUTH_SECRET: 'nextauth_secret_abcdef123456',
    NEXTAUTH_URL: 'http://localhost:3000',
  },
  invalid: {
    OAUTH_CLIENT_ID: 'invalid_id',
    OAUTH_CLIENT_SECRET: 'short', // Too short
    NEXTAUTH_SECRET: '', // Empty
    NEXTAUTH_URL: 'invalid-url',
    TOKEN_ENCRYPTION_KEY: 'short', // Too short for encryption
  },
};

// Mock request information for security logging
export const mockRequestInfo = {
  valid: {
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  },
  localhost: {
    ip: '127.0.0.1',
    userAgent: 'curl/7.68.0',
  },
  mobile: {
    ip: '192.168.1.200',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  },
};

// Test scenario generators
export const createErrorScenarios = () => [
  {
    name: 'Invalid Token',
    token: mockOAuthTokens.invalid.access_token,
    expectedError: mockAPIErrors.unauthorized,
  },
  {
    name: 'Expired Token',
    token: mockOAuthTokens.expired.access_token,
    expectedError: mockAPIErrors.unauthorized,
  },
  {
    name: 'Repository Not Found',
    token: mockOAuthTokens.valid.access_token,
    repository: 'nonexistent/repo',
    expectedError: mockAPIErrors.notFound,
  },
  {
    name: 'Insufficient Permissions',
    token: mockOAuthTokens.valid.access_token,
    repository: 'testuser/no-access-repo',
    expectedError: mockAPIErrors.forbidden,
  },
];

export const createValidationScenarios = () => [
  {
    name: 'Valid Configuration',
    config: mockOAuthConfigurations.validConfiguration,
    expectedValid: true,
  },
  {
    name: 'Invalid Emails',
    config: mockOAuthConfigurations.configurationWithInvalidEmails,
    expectedValid: false,
    expectedErrors: ['invalid-email', 'duplicate'],
  },
  {
    name: 'Invalid Repository',
    config: mockOAuthConfigurations.configurationWithInvalidRepository,
    expectedValid: false,
    expectedErrors: ['repository format'],
  },
  {
    name: 'Empty Configuration',
    config: mockOAuthConfigurations.emptyConfiguration,
    expectedValid: false,
    expectedErrors: ['repository', 'email'],
  },
];

// Export default fixture object for easy importing
export default {
  tokens: mockOAuthTokens,
  sessions: mockSessions,
  githubApi: mockGitHubAPIResponses,
  errors: mockAPIErrors,
  configurations: mockOAuthConfigurations,
  database: mockDatabaseRecords,
  webhooks: mockWebhookPayloads,
  providers: mockNextAuthProviders,
  environment: mockEnvironmentVariables,
  requests: mockRequestInfo,
  creators: {
    createMockRepository,
    createMockSession,
  },
  scenarios: {
    createErrorScenarios,
    createValidationScenarios,
  },
}; 