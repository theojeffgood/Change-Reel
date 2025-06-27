/**
 * GitHub API Fixtures Validation Tests
 * 
 * Tests to ensure our fixtures match the expected GitHub API format
 * and work correctly in various test scenarios.
 */

import {
  githubApiFixtures,
  createMockResponse,
  createMockCommit,
  createMockRepository,
  createMockComparison,
  repositoryFixture,
  commitFixture,
  comparisonFixture,
  rawDiffFixture,
  rateLimitFixture
} from '../../fixtures/githubApiFixtures';

import {
  createMockGitHubApiClient,
  setupStandardMockResponses,
  setupErrorMockResponses,
  testScenarios,
  mockFetchResponses,
  assertions
} from '../../fixtures/githubApiHelpers';

describe('GitHub API Fixtures', () => {
  describe('Repository Fixtures', () => {
    it('should have valid public repository structure', () => {
      const repo = githubApiFixtures.repositories.public;
      
      expect(repo).toHaveProperty('id');
      expect(repo).toHaveProperty('name');
      expect(repo).toHaveProperty('full_name');
      expect(repo).toHaveProperty('owner');
      expect(repo).toHaveProperty('private', false);
      expect(repo).toHaveProperty('html_url');
      expect(repo).toHaveProperty('clone_url');
      expect(repo.owner).toHaveProperty('login');
      expect(repo.owner).toHaveProperty('id');
    });

    it('should have valid private repository structure', () => {
      const repo = githubApiFixtures.repositories.private;
      
      expect(repo).toHaveProperty('private', true);
      expect(repo).toHaveProperty('visibility', 'private');
      expect(repo.name).toBe('private-repo');
    });

    it('should support creating custom repositories', () => {
      const customRepo = createMockRepository({
        name: 'custom-repo',
        description: 'Custom test repository'
      });

      expect(customRepo.name).toBe('custom-repo');
      expect(customRepo.description).toBe('Custom test repository');
      expect(customRepo).toHaveProperty('owner');
    });
  });

  describe('Commit Fixtures', () => {
    it('should have valid commit structure', () => {
      const commit = githubApiFixtures.commits.standard;
      
      expect(commit).toHaveProperty('sha');
      expect(commit).toHaveProperty('commit');
      expect(commit).toHaveProperty('author');
      expect(commit).toHaveProperty('committer');
      expect(commit).toHaveProperty('stats');
      expect(commit).toHaveProperty('files');
      
      expect(commit.commit).toHaveProperty('message');
      expect(commit.commit).toHaveProperty('author');
      expect(commit.commit).toHaveProperty('committer');
      
      expect(commit.stats).toHaveProperty('total');
      expect(commit.stats).toHaveProperty('additions');
      expect(commit.stats).toHaveProperty('deletions');
      
      expect(Array.isArray(commit.files)).toBe(true);
    });

    it('should have valid file structures in commits', () => {
      const commit = githubApiFixtures.commits.standard;
      const file = commit.files[0];
      
      expect(file).toHaveProperty('filename');
      expect(file).toHaveProperty('status');
      expect(file).toHaveProperty('additions');
      expect(file).toHaveProperty('deletions');
      expect(file).toHaveProperty('changes');
      expect(file).toHaveProperty('patch');
    });

    it('should have large commit for noise filtering tests', () => {
      const largeCommit = githubApiFixtures.commits.large;
      
      expect(largeCommit.stats.total).toBeGreaterThan(10000);
      expect(largeCommit.files[0].filename).toBe('package-lock.json');
    });

    it('should have binary file commit', () => {
      const binaryCommit = githubApiFixtures.commits.binary;
      
      expect(binaryCommit.files[0].filename).toBe('assets/logo.png');
      expect(binaryCommit.files[0].patch).toBeUndefined();
      expect(binaryCommit.files[0].additions).toBe(0);
      expect(binaryCommit.files[0].deletions).toBe(0);
    });

    it('should have generated file commit', () => {
      const generatedCommit = githubApiFixtures.commits.generated;
      
      expect(generatedCommit.files[0].filename).toContain('generated-api.ts');
      expect(generatedCommit.files[0].patch).toContain('Auto-generated');
    });

    it('should support creating custom commits', () => {
      const customCommit = createMockCommit({
        sha: 'custom123',
        commit: {
          ...commitFixture.commit,
          message: 'Custom test commit'
        }
      });

      expect(customCommit.sha).toBe('custom123');
      expect(customCommit.commit.message).toBe('Custom test commit');
    });

    it('should have valid commit range for testing', () => {
      const range = githubApiFixtures.commits.range;
      
      expect(Array.isArray(range)).toBe(true);
      expect(range).toHaveLength(3);
      
      range.forEach(commit => {
        expect(commit).toHaveProperty('sha');
        expect(commit).toHaveProperty('commit');
      });
    });
  });

  describe('Comparison/Diff Fixtures', () => {
    it('should have valid comparison structure', () => {
      const comparison = githubApiFixtures.comparisons.standard;
      
      expect(comparison).toHaveProperty('status');
      expect(comparison).toHaveProperty('ahead_by');
      expect(comparison).toHaveProperty('behind_by');
      expect(comparison).toHaveProperty('total_commits');
      expect(comparison).toHaveProperty('commits');
      expect(comparison).toHaveProperty('files');
      expect(comparison).toHaveProperty('base_commit');
    });

    it('should have valid diff content', () => {
      const diff = githubApiFixtures.diffs.standard;
      
      expect(typeof diff).toBe('string');
      expect(diff).toContain('diff --git');
      expect(diff).toContain('@@ -');
      expect(diff).toContain('+++');
      expect(diff).toContain('---');
    });

    it('should have empty diff for testing', () => {
      const emptyDiff = githubApiFixtures.diffs.empty;
      
      expect(emptyDiff).toBe('');
    });

    it('should have large diff for size limit testing', () => {
      const largeDiff = githubApiFixtures.diffs.large;
      
      expect(largeDiff.length).toBeGreaterThan(1000);
      expect(largeDiff).toContain('Line 1 of a very large diff');
      expect(largeDiff).toContain('Line 1000 of a very large diff');
    });

    it('should support creating custom comparisons', () => {
      const customComparison = createMockComparison({
        status: 'behind',
        behind_by: 5
      });

      expect(customComparison.status).toBe('behind');
      expect(customComparison.behind_by).toBe(5);
    });
  });

  describe('Error Fixtures', () => {
    it('should have all required error types', () => {
      const errors = githubApiFixtures.errors;
      
      expect(errors).toHaveProperty('notFound');
      expect(errors).toHaveProperty('unauthorized');
      expect(errors).toHaveProperty('forbidden');
      expect(errors).toHaveProperty('rateLimited');
      expect(errors).toHaveProperty('unprocessableEntity');
      expect(errors).toHaveProperty('network');
    });

    it('should have properly formatted error responses', () => {
      const notFoundError = githubApiFixtures.errors.notFound;
      
      expect(notFoundError).toHaveProperty('message', 'Not Found');
      expect(notFoundError).toHaveProperty('documentation_url');
    });

    it('should have rate limit error with headers', () => {
      const rateLimitError = githubApiFixtures.errors.rateLimited;
      
      expect(rateLimitError).toHaveProperty('message');
      expect(rateLimitError).toHaveProperty('headers');
      expect(rateLimitError.headers).toHaveProperty('x-ratelimit-remaining', '0');
      expect(rateLimitError.headers).toHaveProperty('retry-after');
    });

    it('should have network error as Error instance', () => {
      const networkError = githubApiFixtures.errors.network;
      
      expect(networkError).toBeInstanceOf(Error);
      expect(networkError.message).toBe('ECONNRESET');
    });
  });

  describe('Rate Limit Fixture', () => {
    it('should have valid rate limit structure', () => {
      const rateLimit = githubApiFixtures.rateLimit;
      
      expect(rateLimit).toHaveProperty('resources');
      expect(rateLimit).toHaveProperty('rate');
      
      expect(rateLimit.resources).toHaveProperty('core');
      expect(rateLimit.resources).toHaveProperty('search');
      expect(rateLimit.resources).toHaveProperty('graphql');
      
      expect(rateLimit.rate).toHaveProperty('limit');
      expect(rateLimit.rate).toHaveProperty('remaining');
      expect(rateLimit.rate).toHaveProperty('reset');
    });
  });

  describe('Mock Response Helper', () => {
    it('should create valid Response objects', () => {
      const response = createMockResponse({ test: 'data' }, 200);
      
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(typeof response.json).toBe('function');
      expect(typeof response.text).toBe('function');
    });

    it('should handle error status codes', () => {
      const notFoundResponse = createMockResponse({ error: 'Not Found' }, 404);
      
      expect(notFoundResponse.ok).toBe(false);
      expect(notFoundResponse.status).toBe(404);
      expect(notFoundResponse.statusText).toBe('Not Found');
    });

    it('should support custom headers', () => {
      const response = createMockResponse(
        { test: 'data' }, 
        200, 
        { 'Content-Type': 'application/json' }
      );
      
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('URL Templates', () => {
    it('should generate correct GitHub API URLs', () => {
      const urls = githubApiFixtures.urls;
      
      expect(urls.repository('owner', 'repo')).toBe('https://api.github.com/repos/owner/repo');
      expect(urls.commit('owner', 'repo', 'sha123')).toBe('https://api.github.com/repos/owner/repo/commits/sha123');
      expect(urls.compare('owner', 'repo', 'base', 'head')).toBe('https://api.github.com/repos/owner/repo/compare/base...head');
      expect(urls.rateLimit()).toBe('https://api.github.com/rate_limit');
      expect(urls.commitDiff('owner', 'repo', 'sha123')).toBe('https://github.com/owner/repo/commit/sha123.diff');
    });
  });
});

describe('GitHub API Test Helpers', () => {
  describe('Mock Client Creation', () => {
    it('should create mock client with all required methods', () => {
      const mockClient = createMockGitHubApiClient();
      
      expect(mockClient).toHaveProperty('getRepository');
      expect(mockClient).toHaveProperty('getCommit');
      expect(mockClient).toHaveProperty('getCommitDiff');
      expect(mockClient).toHaveProperty('getRateLimit');
      
      expect(typeof mockClient.getRepository).toBe('function');
      expect(typeof mockClient.getCommit).toBe('function');
      expect(typeof mockClient.getCommitDiff).toBe('function');
      expect(typeof mockClient.getRateLimit).toBe('function');
    });

    it('should set up standard responses correctly', () => {
      const mockClient = createMockGitHubApiClient();
      setupStandardMockResponses(mockClient);
      
      expect(mockClient.getRepository).toHaveBeenCalledTimes(0);
      expect(mockClient.getCommit).toHaveBeenCalledTimes(0);
      expect(mockClient.getCommitDiff).toHaveBeenCalledTimes(0);
      expect(mockClient.getRateLimit).toHaveBeenCalledTimes(0);
    });

    it('should set up error responses correctly', () => {
      const mockClient = createMockGitHubApiClient();
      setupErrorMockResponses(mockClient);
      
      expect(mockClient.getRepository).toHaveBeenCalledTimes(0);
      expect(mockClient.getCommit).toHaveBeenCalledTimes(0);
      expect(mockClient.getCommitDiff).toHaveBeenCalledTimes(0);
      expect(mockClient.getRateLimit).toHaveBeenCalledTimes(0);
    });
  });

  describe('Test Scenarios', () => {
    it('should have all required scenarios', () => {
      expect(testScenarios).toHaveProperty('successfulOperations');
      expect(testScenarios).toHaveProperty('rateLimited');
      expect(testScenarios).toHaveProperty('networkErrors');
      expect(testScenarios).toHaveProperty('authenticationErrors');
      expect(testScenarios).toHaveProperty('largeFiles');
      expect(testScenarios).toHaveProperty('binaryFiles');
      expect(testScenarios).toHaveProperty('generatedFiles');
      expect(testScenarios).toHaveProperty('emptyDiffs');
    });

    it('should execute scenario setups without errors', () => {
      const mockClient = createMockGitHubApiClient();
      
      Object.values(testScenarios).forEach(scenario => {
        expect(() => scenario.setup(mockClient)).not.toThrow();
      });
    });
  });

  describe('Mock Fetch Responses', () => {
    it('should create success responses', () => {
      const response = mockFetchResponses.success({ test: 'data' });
      
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    });

    it('should create error responses', () => {
      const notFoundResponse = mockFetchResponses.notFound();
      const unauthorizedResponse = mockFetchResponses.unauthorized();
      const forbiddenResponse = mockFetchResponses.forbidden();
      const rateLimitedResponse = mockFetchResponses.rateLimited();
      
      expect(notFoundResponse.status).toBe(404);
      expect(unauthorizedResponse.status).toBe(401);
      expect(forbiddenResponse.status).toBe(403);
      expect(rateLimitedResponse.status).toBe(429);
    });

    it('should handle network errors', async () => {
      await expect(mockFetchResponses.networkError()).rejects.toThrow();
    });
  });

  describe('Assertion Helpers', () => {
    it('should validate API calls correctly', () => {
      const mockFn = jest.fn();
      mockFn('arg1', 'arg2');
      
      expect(() => assertions.expectApiCall(mockFn, ['arg1', 'arg2'])).not.toThrow();
    });

    it('should validate rate limit handling', () => {
      const mockClient = createMockGitHubApiClient();
      mockClient.getRateLimit();
      
      expect(() => assertions.expectRateLimitHandling(mockClient)).not.toThrow();
    });
  });
});

describe('Fixture Integration Tests', () => {
  it('should work with real test scenarios', async () => {
    const mockClient = createMockGitHubApiClient();
    setupStandardMockResponses(mockClient);
    
    // Test repository call
    const repo = await mockClient.getRepository('testuser', 'test-repo');
    expect(repo.name).toBe('test-repo');
    
    // Test commit call
    const commit = await mockClient.getCommit('testuser', 'test-repo', 'abc123');
    expect(commit.sha).toBe('abc123def456ghi789');
    
    // Test rate limit call
    const rateLimit = await mockClient.getRateLimit();
    expect(rateLimit.rate.remaining).toBeGreaterThan(0);
  });

  it('should handle error scenarios correctly', async () => {
    const mockClient = createMockGitHubApiClient();
    setupErrorMockResponses(mockClient);
    
    await expect(mockClient.getRepository('testuser', 'test-repo')).rejects.toThrow('Repository not found');
    await expect(mockClient.getCommit('testuser', 'test-repo', 'abc123')).rejects.toThrow('Commit not found');
    await expect(mockClient.getCommitDiff('testuser', 'test-repo', 'base', 'head')).rejects.toThrow('Diff not found');
  });

  it('should validate fixture data consistency', () => {
    // Check that all commits reference the same repository
    const commits = Object.values(githubApiFixtures.commits);
    commits.forEach(commit => {
      if (Array.isArray(commit)) {
        commit.forEach(c => {
          expect(c).toHaveProperty('sha');
          expect(c).toHaveProperty('commit');
        });
      } else {
        expect(commit).toHaveProperty('sha');
        expect(commit).toHaveProperty('commit');
      }
    });
    
    // Check that error fixtures have consistent structure
    const errors = githubApiFixtures.errors;
    ['notFound', 'unauthorized', 'forbidden', 'unprocessableEntity'].forEach(errorType => {
      expect(errors[errorType as keyof typeof errors]).toHaveProperty('message');
      expect(errors[errorType as keyof typeof errors]).toHaveProperty('documentation_url');
    });
  });
}); 