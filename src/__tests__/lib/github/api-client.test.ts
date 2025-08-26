/**
 * Tests for GitHub API Client
 * 
 * Following TDD approach with comprehensive test coverage for:
 * - Client initialization and configuration validation
 * - API operations (getCommit, getCommitDiff, etc.)
 * - Error handling for various scenarios
 * - Rate limiting and network failures
 */

import { 
  GitHubApiClient, 
  createGitHubClient, 
  createGitHubClientFromEnv,
  type GitHubClientConfig,
  type IGitHubApiClient 
} from '@/lib/github/api-client';

// Mock Octokit to avoid actual API calls
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      repos: {
        getCommit: jest.fn(),
        compareCommits: jest.fn(),
        get: jest.fn(),
      },
      rateLimit: {
        get: jest.fn(),
      },
    },
  })),
}));

describe('GitHubApiClient', () => {
  let mockOctokit: any;
  let validConfig: GitHubClientConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock Octokit instance
    mockOctokit = {
      rest: {
        repos: {
          getCommit: jest.fn(),
          compareCommits: jest.fn(),
          get: jest.fn(),
        },
        rateLimit: {
          get: jest.fn(),
        },
      },
    };

    // Mock Octokit constructor to return our mock
    const { Octokit } = require('@octokit/rest');
    (Octokit as jest.Mock).mockImplementation(() => mockOctokit);

    validConfig = {
      auth: 'ghp_1234567890abcdef',
      userAgent: 'test-app/1.0.0',
      timeout: 5000,
      retries: 2,
    };
  });

  describe('Constructor and Configuration', () => {
    it('should create client with valid configuration', () => {
      const client = new GitHubApiClient(validConfig);
      expect(client).toBeInstanceOf(GitHubApiClient);
      
      const { Octokit } = require('@octokit/rest');
      expect(Octokit).toHaveBeenCalledWith({
        auth: validConfig.auth,
        userAgent: validConfig.userAgent,
        baseUrl: undefined,
        request: {
          timeout: validConfig.timeout,
          retries: validConfig.retries,
        },
      });
    });

    it('should use default values for optional config parameters', () => {
      const minimalConfig = { auth: 'ghp_1234567890abcdef' };
      const client = new GitHubApiClient(minimalConfig);
      
      const { Octokit } = require('@octokit/rest');
      expect(Octokit).toHaveBeenCalledWith({
        auth: minimalConfig.auth,
        userAgent: 'wins-column/1.0.0',
        baseUrl: undefined,
        request: {
          timeout: 10000,
          retries: 3,
        },
      });
    });

    it('should throw error when auth token is missing', () => {
      const invalidConfig = { auth: '' } as GitHubClientConfig;
      expect(() => new GitHubApiClient(invalidConfig)).toThrow('GitHub API token is required');
    });

    it('should throw error when auth token is not a string', () => {
      const invalidConfig = { auth: null as any };
      expect(() => new GitHubApiClient(invalidConfig)).toThrow('GitHub API token must be a non-empty string');
    });

    it('should throw error when auth token has invalid format', () => {
      const invalidConfig = { auth: 'invalid_token_format' };
      expect(() => new GitHubApiClient(invalidConfig)).toThrow('Invalid GitHub token format');
    });

    it('should accept valid token prefixes', () => {
      const validPrefixes = ['ghp_', 'github_pat_', 'gho_', 'ghu_', 'ghs_', 'ghr_'];
      
      validPrefixes.forEach(prefix => {
        const config = { auth: `${prefix}1234567890abcdef` };
        expect(() => new GitHubApiClient(config)).not.toThrow();
      });
    });
  });

  describe('getCommit', () => {
    let client: IGitHubApiClient;

    beforeEach(() => {
      client = new GitHubApiClient(validConfig);
    });

    it('should successfully retrieve commit data', async () => {
      const mockCommitData = {
        sha: 'abc123',
        commit: {
          message: 'Test commit',
          author: { name: 'Test Author' },
        },
      };

      mockOctokit.rest.repos.getCommit.mockResolvedValue({
        data: mockCommitData,
      });

      const result = await client.getCommit('owner', 'repo', 'abc123');

      expect(result).toEqual(mockCommitData);
      expect(mockOctokit.rest.repos.getCommit).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'abc123',
      });
    });

    it('should handle 401 authentication errors', async () => {
      const error = { status: 401, message: 'Bad credentials' };
      mockOctokit.rest.repos.getCommit.mockRejectedValue(error);

      await expect(client.getCommit('owner', 'repo', 'abc123'))
        .rejects.toThrow('GitHub API authentication failed for getCommit: Invalid or expired token');
    });

    it('should handle 404 not found errors', async () => {
      const error = { status: 404, message: 'Not Found' };
      mockOctokit.rest.repos.getCommit.mockRejectedValue(error);

      await expect(client.getCommit('owner', 'repo', 'nonexistent'))
        .rejects.toThrow('GitHub API resource not found for getCommit: Not Found');
    });

    it('should handle rate limit errors', async () => {
      const error = {
        status: 403,
        message: 'API rate limit exceeded',
        response: {
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '1234567890',
          },
        },
      };
      mockOctokit.rest.repos.getCommit.mockRejectedValue(error);

      await expect(client.getCommit('owner', 'repo', 'abc123'))
        .rejects.toThrow('GitHub API rate limit exceeded for getCommit. Resets at: 1234567890');
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      mockOctokit.rest.repos.getCommit.mockRejectedValue(error);

      await expect(client.getCommit('owner', 'repo', 'abc123'))
        .rejects.toThrow('GitHub API network error for getCommit: Network error');
    });
  });

  describe('getCommitDiff', () => {
    let client: IGitHubApiClient;

    beforeEach(() => {
      client = new GitHubApiClient(validConfig);
    });

    it('should successfully retrieve commit diff', async () => {
      const mockDiffData = {
        diff_url: 'https://github.com/owner/repo/compare/base...head.diff',
        files: [
          {
            filename: 'test.js',
            additions: 5,
            deletions: 2,
            patch: '@@ -1,3 +1,6 @@\n console.log("test");',
          },
        ],
      };

      mockOctokit.rest.repos.compareCommits.mockResolvedValue({
        data: mockDiffData,
      });

      const result = await client.getCommitDiff('owner', 'repo', 'base', 'head');

      expect(result).toEqual(mockDiffData);
      expect(mockOctokit.rest.repos.compareCommits).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        base: 'base',
        head: 'head',
        mediaType: {
          format: 'diff',
        },
      });
    });

    it('should handle comparison errors', async () => {
      const error = { status: 422, message: 'No common ancestor' };
      mockOctokit.rest.repos.compareCommits.mockRejectedValue(error);

      await expect(client.getCommitDiff('owner', 'repo', 'base', 'head'))
        .rejects.toThrow('GitHub API validation error for getCommitDiff: No common ancestor');
    });
  });

  describe('getRepository', () => {
    let client: IGitHubApiClient;

    beforeEach(() => {
      client = new GitHubApiClient(validConfig);
    });

    it('should successfully retrieve repository data', async () => {
      const mockRepoData = {
        id: 123,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        private: false,
      };

      mockOctokit.rest.repos.get.mockResolvedValue({
        data: mockRepoData,
      });

      const result = await client.getRepository('owner', 'test-repo');

      expect(result).toEqual(mockRepoData);
      expect(mockOctokit.rest.repos.get).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'test-repo',
      });
    });
  });

  describe('getRateLimit', () => {
    let client: IGitHubApiClient;

    beforeEach(() => {
      client = new GitHubApiClient(validConfig);
    });

    it('should successfully retrieve rate limit data', async () => {
      const mockRateLimitData = {
        rate: {
          limit: 5000,
          remaining: 4999,
          reset: 1234567890,
        },
      };

      mockOctokit.rest.rateLimit.get.mockResolvedValue({
        data: mockRateLimitData,
      });

      const result = await client.getRateLimit();

      expect(result).toEqual(mockRateLimitData);
      expect(mockOctokit.rest.rateLimit.get).toHaveBeenCalledWith();
    });
  });

  describe('Factory Functions', () => {
    it('should create client using factory function', () => {
      const client = createGitHubClient(validConfig);
      expect(client).toBeInstanceOf(GitHubApiClient);
    });

    it('should create client from environment variables', () => {
      const originalEnv = process.env.GITHUB_TOKEN;
      process.env.GITHUB_TOKEN = 'ghp_env_token_123';

      const client = createGitHubClientFromEnv();
      expect(client).toBeInstanceOf(GitHubApiClient);

      // Restore original environment
      if (originalEnv) {
        process.env.GITHUB_TOKEN = originalEnv;
      } else {
        delete process.env.GITHUB_TOKEN;
      }
    });

    it('should throw error when environment token is missing', () => {
      const originalEnv = process.env.GITHUB_TOKEN;
      const originalApiToken = process.env.GITHUB_API_TOKEN;
      
      delete process.env.GITHUB_TOKEN;
      delete process.env.GITHUB_API_TOKEN;

      expect(() => createGitHubClientFromEnv())
        .toThrow('GitHub token not found. Set GITHUB_TOKEN or GITHUB_API_TOKEN environment variable.');

      // Restore original environment
      if (originalEnv) process.env.GITHUB_TOKEN = originalEnv;
      if (originalApiToken) process.env.GITHUB_API_TOKEN = originalApiToken;
    });

    it('should use GITHUB_API_TOKEN as fallback', () => {
      const originalEnv = process.env.GITHUB_TOKEN;
      const originalApiToken = process.env.GITHUB_API_TOKEN;
      
      delete process.env.GITHUB_TOKEN;
      process.env.GITHUB_API_TOKEN = 'ghp_api_token_123';

      const client = createGitHubClientFromEnv();
      expect(client).toBeInstanceOf(GitHubApiClient);

      // Restore original environment
      if (originalEnv) process.env.GITHUB_TOKEN = originalEnv;
      if (originalApiToken) {
        process.env.GITHUB_API_TOKEN = originalApiToken;
      } else {
        delete process.env.GITHUB_API_TOKEN;
      }
    });
  });

  describe('Error Handling Edge Cases', () => {
    let client: IGitHubApiClient;

    beforeEach(() => {
      client = new GitHubApiClient(validConfig);
    });

    it('should handle unknown HTTP status codes', async () => {
      const error = { status: 500, message: 'Internal Server Error' };
      mockOctokit.rest.repos.getCommit.mockRejectedValue(error);

      await expect(client.getCommit('owner', 'repo', 'abc123'))
        .rejects.toThrow('GitHub API error for getCommit (500): Internal Server Error');
    });

    it('should handle 403 errors that are not rate limiting', async () => {
      const error = {
        status: 403,
        message: 'Repository access blocked',
        response: {
          headers: {
            'x-ratelimit-remaining': '100',
          },
        },
      };
      mockOctokit.rest.repos.getCommit.mockRejectedValue(error);

      await expect(client.getCommit('owner', 'repo', 'abc123'))
        .rejects.toThrow('GitHub API access forbidden for getCommit: Repository access blocked');
    });

    it('should handle errors without status code', async () => {
      const error = new Error('Connection timeout');
      mockOctokit.rest.repos.getCommit.mockRejectedValue(error);

      await expect(client.getCommit('owner', 'repo', 'abc123'))
        .rejects.toThrow('GitHub API network error for getCommit: Connection timeout');
    });
  });
}); 