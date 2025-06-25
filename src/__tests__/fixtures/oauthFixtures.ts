/**
 * Test fixtures for OAuth authentication scenarios
 * 
 * This file contains mock data for testing OAuth flows, GitHub API responses,
 * and various authentication states for comprehensive test coverage.
 */

// Mock OAuth tokens and session data
export const mockOAuthTokens = {
  validGitHubToken: 'ghp_1234567890abcdef1234567890abcdef12345678',
  validFineGrainedToken: 'github_pat_11ABCDEFG_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  expiredToken: 'ghp_expired_token_1234567890abcdef12345678',
  invalidToken: 'invalid_token_format',
  shortToken: 'ghp_short',
  revokedToken: 'ghp_revoked_token_1234567890abcdef12345678',
};

export const mockOAuthSessions = {
  authenticatedSession: {
    user: {
      id: '12345678',
      login: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      avatar_url: 'https://avatars.githubusercontent.com/u/12345678?v=4',
    },
    accessToken: mockOAuthTokens.validGitHubToken,
    provider: 'github',
    expires: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
  },
  expiredSession: {
    user: {
      id: '12345678',
      login: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      avatar_url: 'https://avatars.githubusercontent.com/u/12345678?v=4',
    },
    accessToken: mockOAuthTokens.expiredToken,
    provider: 'github',
    expires: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  },
  unauthenticatedSession: null,
  incompleteSession: {
    user: {
      id: '12345678',
      login: 'testuser',
    },
    // Missing accessToken
  },
};

// Mock GitHub API responses
export const mockGitHubApiResponses = {
  userInfo: {
    id: 12345678,
    login: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    avatar_url: 'https://avatars.githubusercontent.com/u/12345678?v=4',
    type: 'User',
    public_repos: 15,
    followers: 100,
    following: 50,
  },
  repositories: [
    {
      id: 123456789,
      name: 'test-repo',
      full_name: 'testuser/test-repo',
      description: 'A test repository for development',
      private: false,
      html_url: 'https://github.com/testuser/test-repo',
      default_branch: 'main',
      permissions: {
        admin: true,
        push: true,
        pull: true,
      },
      owner: {
        login: 'testuser',
        id: 12345678,
      },
    },
    {
      id: 987654321,
      name: 'private-repo',
      full_name: 'testuser/private-repo',
      description: 'A private repository',
      private: true,
      html_url: 'https://github.com/testuser/private-repo',
      default_branch: 'main',
      permissions: {
        admin: false,
        push: true,
        pull: true,
      },
      owner: {
        login: 'testuser',
        id: 12345678,
      },
    },
    {
      id: 555666777,
      name: 'read-only-repo',
      full_name: 'testuser/read-only-repo',
      description: 'A repository with read-only access',
      private: false,
      html_url: 'https://github.com/testuser/read-only-repo',
      default_branch: 'main',
      permissions: {
        admin: false,
        push: false,
        pull: true,
      },
      owner: {
        login: 'testuser',
        id: 12345678,
      },
    },
  ],
  repositoryDetails: {
    id: 123456789,
    name: 'test-repo',
    full_name: 'testuser/test-repo',
    description: 'A test repository for development',
    private: false,
    html_url: 'https://github.com/testuser/test-repo',
    clone_url: 'https://github.com/testuser/test-repo.git',
    ssh_url: 'git@github.com:testuser/test-repo.git',
    default_branch: 'main',
    language: 'TypeScript',
    stargazers_count: 42,
    watchers_count: 15,
    forks_count: 5,
    open_issues_count: 3,
    permissions: {
      admin: true,
      push: true,
      pull: true,
    },
    owner: {
      login: 'testuser',
      id: 12345678,
      avatar_url: 'https://avatars.githubusercontent.com/u/12345678?v=4',
    },
  },
  webhooks: [
    {
      id: 111222333,
      name: 'web',
      active: true,
      events: ['push', 'pull_request'],
      config: {
        url: 'https://example.com/webhook',
        content_type: 'json',
        insecure_ssl: '0',
      },
    },
  ],
};

// Mock error responses
export const mockErrorResponses = {
  invalidToken: {
    status: 401,
    data: {
      message: 'Bad credentials',
      documentation_url: 'https://docs.github.com/rest',
    },
  },
  repositoryNotFound: {
    status: 404,
    data: {
      message: 'Not Found',
      documentation_url: 'https://docs.github.com/rest/repos/repos#get-a-repository',
    },
  },
  rateLimitExceeded: {
    status: 429,
    data: {
      message: 'API rate limit exceeded',
      documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting',
    },
  },
  insufficientPermissions: {
    status: 403,
    data: {
      message: 'Resource not accessible by integration',
      documentation_url: 'https://docs.github.com/rest',
    },
  },
  serverError: {
    status: 500,
    data: {
      message: 'Internal Server Error',
    },
  },
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
    repository: mockGitHubApiResponses.repositoryDetails,
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
    repository: mockGitHubApiResponses.repositoryDetails,
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
    GITHUB_CLIENT_ID: 'github_client_id_12345',
    GITHUB_CLIENT_SECRET: 'github_client_secret_67890',
    NEXTAUTH_SECRET: 'nextauth_secret_abcdef123456',
    NEXTAUTH_URL: 'http://localhost:3000',
    TOKEN_ENCRYPTION_KEY: 'change-reel-secure-encryption-key-2024-v1-production-grade!!',
  },
  missing: {
    // GITHUB_CLIENT_ID is missing
    GITHUB_CLIENT_SECRET: 'github_client_secret_67890',
    NEXTAUTH_SECRET: 'nextauth_secret_abcdef123456',
    NEXTAUTH_URL: 'http://localhost:3000',
  },
  invalid: {
    GITHUB_CLIENT_ID: 'invalid_id',
    GITHUB_CLIENT_SECRET: 'short', // Too short
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

// Utility functions for creating dynamic fixtures
export const createMockRepository = (overrides: Partial<typeof mockGitHubApiResponses.repositories[0]> = {}) => ({
  ...mockGitHubApiResponses.repositories[0],
  ...overrides,
});

export const createMockSession = (overrides: Partial<typeof mockOAuthSessions.authenticatedSession> = {}) => ({
  ...mockOAuthSessions.authenticatedSession,
  ...overrides,
});

export const createMockConfiguration = (overrides: Partial<typeof mockOAuthConfigurations.validConfiguration> = {}) => ({
  ...mockOAuthConfigurations.validConfiguration,
  ...overrides,
});

export const createMockWebhookPayload = (overrides: Partial<typeof mockWebhookPayloads.pushEvent> = {}) => ({
  ...mockWebhookPayloads.pushEvent,
  ...overrides,
});

// Test scenario generators
export const createErrorScenarios = () => [
  {
    name: 'Invalid Token',
    token: mockOAuthTokens.invalidToken,
    expectedError: mockErrorResponses.invalidToken,
  },
  {
    name: 'Expired Token',
    token: mockOAuthTokens.expiredToken,
    expectedError: mockErrorResponses.invalidToken,
  },
  {
    name: 'Repository Not Found',
    token: mockOAuthTokens.validGitHubToken,
    repository: 'nonexistent/repo',
    expectedError: mockErrorResponses.repositoryNotFound,
  },
  {
    name: 'Insufficient Permissions',
    token: mockOAuthTokens.validGitHubToken,
    repository: 'testuser/read-only-repo',
    expectedError: mockErrorResponses.insufficientPermissions,
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
  sessions: mockOAuthSessions,
  githubApi: mockGitHubApiResponses,
  errors: mockErrorResponses,
  configurations: mockOAuthConfigurations,
  database: mockDatabaseRecords,
  webhooks: mockWebhookPayloads,
  providers: mockNextAuthProviders,
  environment: mockEnvironmentVariables,
  requests: mockRequestInfo,
  creators: {
    createMockRepository,
    createMockSession,
    createMockConfiguration,
    createMockWebhookPayload,
  },
  scenarios: {
    createErrorScenarios,
    createValidationScenarios,
  },
}; 