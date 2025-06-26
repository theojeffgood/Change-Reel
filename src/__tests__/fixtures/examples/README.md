# GitHub API Fixtures - Usage Examples

This directory contains comprehensive test fixtures and helpers for testing GitHub API integration in the Change Reel project.

## Overview

The fixtures provide realistic GitHub API responses for testing our GitHub integration services without making real API calls.

## Available Fixtures

### Core Fixtures

- **`githubApiFixtures.ts`** - Main fixture data including repositories, commits, comparisons, diffs, errors, and rate limits
- **`githubApiHelpers.ts`** - Helper functions for setting up mocks and test scenarios

### What's Included

#### Repository Data
```typescript
import { githubApiFixtures } from '../githubApiFixtures';

// Public repository
const publicRepo = githubApiFixtures.repositories.public;

// Private repository  
const privateRepo = githubApiFixtures.repositories.private;

// Custom repository
const customRepo = createMockRepository({
  name: 'my-test-repo',
  description: 'Custom test repository'
});
```

#### Commit Data
```typescript
// Standard commit with realistic file changes
const commit = githubApiFixtures.commits.standard;

// Large commit for testing noise filtering
const largeCommit = githubApiFixtures.commits.large;

// Binary file commit
const binaryCommit = githubApiFixtures.commits.binary;

// Generated file commit
const generatedCommit = githubApiFixtures.commits.generated;

// Range of commits
const commitRange = githubApiFixtures.commits.range;
```

#### Comparison/Diff Data
```typescript
// Standard comparison between branches
const comparison = githubApiFixtures.comparisons.standard;

// Raw diff content
const diff = githubApiFixtures.diffs.standard;
const largeDiff = githubApiFixtures.diffs.large;
const emptyDiff = githubApiFixtures.diffs.empty;
```

#### Error Scenarios
```typescript
const errors = githubApiFixtures.errors;

// 404 Not Found
const notFound = errors.notFound;

// 401 Unauthorized
const unauthorized = errors.unauthorized;

// 403 Rate Limited
const rateLimited = errors.rateLimited;

// Network error
const networkError = errors.network;
```

## Usage Examples

### Basic Mock Setup

```typescript
import { 
  createMockGitHubApiClient, 
  setupStandardMockResponses 
} from '../githubApiHelpers';
import { GitHubCommitService } from '../../../lib/github/commit-service';

describe('GitHubCommitService', () => {
  let mockClient: jest.Mocked<IGitHubApiClient>;
  let commitService: GitHubCommitService;

  beforeEach(() => {
    mockClient = createMockGitHubApiClient();
    setupStandardMockResponses(mockClient);
    commitService = new GitHubCommitService(mockClient);
  });

  it('should fetch commit details', async () => {
    const commit = await commitService.getCommitDetails('owner', 'repo', 'sha123');
    
    expect(commit.sha).toBe('abc123def456ghi789');
    expect(commit.message).toContain('Fix authentication bug');
  });
});
```

### Error Scenario Testing

```typescript
import { 
  createMockGitHubApiClient,
  setupErrorMockResponses,
  testScenarios
} from '../githubApiHelpers';

describe('Error Handling', () => {
  it('should handle rate limiting', async () => {
    const mockClient = createMockGitHubApiClient();
    testScenarios.rateLimited.setup(mockClient);
    
    await expect(
      commitService.getCommitDetails('owner', 'repo', 'sha123')
    ).rejects.toThrow('API rate limit exceeded');
  });

  it('should handle network errors', async () => {
    const mockClient = createMockGitHubApiClient();
    testScenarios.networkErrors.setup(mockClient);
    
    await expect(
      commitService.getCommitDetails('owner', 'repo', 'sha123')
    ).rejects.toThrow('ECONNRESET');
  });
});
```

### Using Test Scenarios

```typescript
import { testScenarios, describeScenarios } from '../githubApiHelpers';

// Test multiple scenarios with a single function
describeScenarios(
  'GitHubCommitService.getCommitDetails',
  ['successfulOperations', 'rateLimited', 'networkErrors'],
  (scenario) => {
    it(`should handle ${scenario.name}`, async () => {
      const mockClient = createMockGitHubApiClient();
      scenario.setup(mockClient);
      
      if (scenario.name.includes('error')) {
        await expect(service.getCommitDetails('owner', 'repo', 'sha')).rejects.toThrow();
      } else {
        const result = await service.getCommitDetails('owner', 'repo', 'sha');
        expect(result).toBeDefined();
      }
    });
  }
);
```

### Service Test Suite Generator

```typescript
import { createServiceTestSuite } from '../githubApiHelpers';

describe('GitHubCommitService', createServiceTestSuite(
  'GitHubCommitService',
  (client) => new GitHubCommitService(client),
  [
    {
      method: 'getCommitDetails',
      args: ['owner', 'repo', 'sha123'],
      expectation: (result) => {
        expect(result.sha).toBe('abc123def456ghi789');
        expect(result.message).toBeDefined();
      },
      scenarios: ['successfulOperations', 'rateLimited']
    },
    {
      method: 'validateCommitExists',
      args: ['owner', 'repo', 'sha123'],
      expectation: (result) => {
        expect(result).toBe(true);
      }
    }
  ]
));
```

### Cache Testing with Fixtures

```typescript
import { githubApiFixtures } from '../githubApiFixtures';
import { MemoryCache } from '../../../lib/github/cache';
import { CachedGitHubApiClient } from '../../../lib/github/cached-services';

describe('Cached GitHub API', () => {
  it('should cache commit responses', async () => {
    const cache = new MemoryCache();
    const mockClient = createMockGitHubApiClient();
    const cachedClient = new CachedGitHubApiClient(mockClient, cache);
    
    setupStandardMockResponses(mockClient);
    
    // First call - should hit API
    await cachedClient.getCommit('owner', 'repo', 'sha123');
    expect(mockClient.getCommit).toHaveBeenCalledTimes(1);
    
    // Second call - should use cache
    await cachedClient.getCommit('owner', 'repo', 'sha123');
    expect(mockClient.getCommit).toHaveBeenCalledTimes(1);
    
    // Verify cache statistics
    const stats = cache.getStats();
    expect(stats.hitRate).toBeGreaterThan(0);
  });
});
```

### Noise Filter Testing

```typescript
import { githubApiFixtures } from '../githubApiFixtures';
import { NoiseFilter } from '../../../lib/github/noise-filter';

describe('NoiseFilter with Fixtures', () => {
  it('should filter large files', () => {
    const filter = new NoiseFilter({ maxFileSize: 1000 });
    
    // Use large commit fixture
    const largeCommit = githubApiFixtures.commits.large;
    const parsedFiles = /* convert commit to ParsedDiffFile format */;
    
    const result = filter.filter(parsedFiles);
    
    expect(result.filteredFiles.length).toBeLessThan(parsedFiles.length);
    expect(result.stats.filterReasons['large-file']).toBeGreaterThan(0);
  });
  
  it('should filter binary files', () => {
    const filter = new NoiseFilter();
    
    // Use binary commit fixture
    const binaryCommit = githubApiFixtures.commits.binary;
    const parsedFiles = /* convert commit to ParsedDiffFile format */;
    
    const result = filter.filter(parsedFiles);
    
    expect(result.stats.filterReasons['binary-file']).toBeGreaterThan(0);
  });
});
```

## Available Test Scenarios

The fixtures include predefined test scenarios for common testing patterns:

- `successfulOperations` - Standard successful API operations
- `rateLimited` - Rate limited API responses
- `networkErrors` - Network connectivity issues  
- `authenticationErrors` - Authentication failures
- `largeFiles` - Large file scenarios for noise filtering
- `binaryFiles` - Binary files that should be filtered
- `generatedFiles` - Generated files that should be filtered
- `emptyDiffs` - Empty diffs for edge case testing

## Custom Fixtures

You can create custom fixtures for specific test cases:

```typescript
import { createMockCommit, createMockRepository } from '../githubApiFixtures';

const customCommit = createMockCommit({
  sha: 'test123',
  commit: {
    message: 'Test commit for specific scenario',
    author: {
      name: 'Test Author',
      email: 'test@example.com'
    }
  },
  files: [
    {
      filename: 'test-file.ts',
      status: 'modified',
      additions: 10,
      deletions: 5,
      patch: '// Your custom patch content here'
    }
  ]
});
```

## Best Practices

1. **Use Standard Fixtures First** - Start with the provided fixtures before creating custom ones
2. **Test Error Scenarios** - Always test error handling with the provided error scenarios
3. **Validate Cache Behavior** - Test both cached and non-cached API interactions
4. **Test Noise Filtering** - Use large, binary, and generated file fixtures to test filtering
5. **Mock Consistently** - Use the helper functions to ensure consistent mock setup
6. **Verify API Contracts** - The fixtures match actual GitHub API response formats

## File Structure

```
src/__tests__/fixtures/
├── githubApiFixtures.ts     # Main fixture data
├── githubApiHelpers.ts      # Test helpers and mock utilities
└── examples/
    └── README.md           # This documentation
```

These fixtures enable comprehensive testing of the GitHub API integration without requiring real API calls, making tests faster, more reliable, and independent of external services. 