/**
 * GitHub API Test Helpers
 * 
 * Utility functions and helpers for working with GitHub API fixtures in tests.
 * Provides convenient methods for setting up mocks and creating test scenarios.
 */

import { jest } from '@jest/globals';
import { 
  githubApiFixtures, 
  createMockResponse
} from './githubApiFixtures';
import type { IGitHubApiClient } from '../../lib/github/api-client';

/**
 * Creates a mock GitHub API client with predefined responses
 */
export function createMockGitHubApiClient(): jest.Mocked<IGitHubApiClient> {
  return {
    getRepository: jest.fn(),
    getCommit: jest.fn(),
    getCommitDiff: jest.fn(),
    getCommitDiffRaw: jest.fn(),
    getRateLimit: jest.fn()
  } as jest.Mocked<IGitHubApiClient>;
}

/**
 * Sets up standard mock responses for GitHub API client
 */
export function setupStandardMockResponses(mockClient: jest.Mocked<IGitHubApiClient>) {
  // Repository responses
  mockClient.getRepository.mockResolvedValue(githubApiFixtures.repositories.public);
  
  // Commit responses  
  mockClient.getCommit.mockResolvedValue(githubApiFixtures.commits.standard as any);
  
  // Diff responses
  mockClient.getCommitDiff.mockResolvedValue(githubApiFixtures.comparisons.standard as any);
  
  // Rate limit responses
  mockClient.getRateLimit.mockResolvedValue(githubApiFixtures.rateLimit);
}

/**
 * Sets up error scenario mock responses
 */
export function setupErrorMockResponses(mockClient: jest.Mocked<IGitHubApiClient>) {
  mockClient.getRepository.mockRejectedValue(new Error('Repository not found'));
  mockClient.getCommit.mockRejectedValue(new Error('Commit not found'));
  mockClient.getCommitDiff.mockRejectedValue(new Error('Diff not found'));
  mockClient.getRateLimit.mockRejectedValue(new Error('Rate limit API unavailable'));
}

/**
 * Creates mock fetch responses for testing raw API calls
 */
export const mockFetchResponses = {
  success: (data: any) => createMockResponse(data, 200),
  notFound: () => createMockResponse(githubApiFixtures.errors.notFound, 404),
  unauthorized: () => createMockResponse(githubApiFixtures.errors.unauthorized, 401),
  forbidden: () => createMockResponse(githubApiFixtures.errors.forbidden, 403),
  rateLimited: () => createMockResponse(
    githubApiFixtures.errors.rateLimited, 
    429, 
    githubApiFixtures.errors.rateLimited.headers
  ),
  networkError: () => Promise.reject(githubApiFixtures.errors.network)
};

/**
 * Sets up global fetch mock for testing
 */
export function setupFetchMock() {
  const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  global.fetch = mockFetch;
  return mockFetch;
}

/**
 * Test scenario generators for common testing patterns
 */
export const testScenarios = {
  /**
   * Standard successful API operations
   */
  successfulOperations: {
    name: 'successful operations',
    setup: (mockClient: jest.Mocked<IGitHubApiClient>) => {
      setupStandardMockResponses(mockClient);
    }
  },

  /**
   * Rate limited API responses
   */
  rateLimited: {
    name: 'rate limited',
    setup: (mockClient: jest.Mocked<IGitHubApiClient>) => {
      mockClient.getRepository.mockRejectedValue(
        Object.assign(new Error('API rate limit exceeded'), { status: 403 })
      );
      mockClient.getCommit.mockRejectedValue(
        Object.assign(new Error('API rate limit exceeded'), { status: 403 })
      );
    }
  },

  /**
   * Network connectivity issues
   */
  networkErrors: {
    name: 'network errors',
    setup: (mockClient: jest.Mocked<IGitHubApiClient>) => {
      const networkError = new Error('ECONNRESET');
      mockClient.getRepository.mockRejectedValue(networkError);
      mockClient.getCommit.mockRejectedValue(networkError);
      mockClient.getCommitDiff.mockRejectedValue(networkError);
    }
  },

  /**
   * Authentication failures
   */
  authenticationErrors: {
    name: 'authentication errors',
    setup: (mockClient: jest.Mocked<IGitHubApiClient>) => {
      const authError = Object.assign(new Error('Bad credentials'), { status: 401 });
      mockClient.getRepository.mockRejectedValue(authError);
      mockClient.getCommit.mockRejectedValue(authError);
    }
  },

  /**
   * Large file scenarios that should trigger noise filtering
   */
  largeFiles: {
    name: 'large files',
    setup: (mockClient: jest.Mocked<IGitHubApiClient>) => {
      mockClient.getCommit.mockResolvedValue(githubApiFixtures.commits.large as any);
      mockClient.getCommitDiff.mockResolvedValue(githubApiFixtures.diffs.large as any);
    }
  },

  /**
   * Binary files that should be filtered out
   */
  binaryFiles: {
    name: 'binary files',
    setup: (mockClient: jest.Mocked<IGitHubApiClient>) => {
      mockClient.getCommit.mockResolvedValue(githubApiFixtures.commits.binary as any);
    }
  },

  /**
   * Generated files that should be filtered out
   */
  generatedFiles: {
    name: 'generated files',
    setup: (mockClient: jest.Mocked<IGitHubApiClient>) => {
      mockClient.getCommit.mockResolvedValue(githubApiFixtures.commits.generated as any);
    }
  },

  /**
   * Empty diffs
   */
  emptyDiffs: {
    name: 'empty diffs',
    setup: (mockClient: jest.Mocked<IGitHubApiClient>) => {
      mockClient.getCommitDiff.mockResolvedValue(githubApiFixtures.diffs.empty as any);
    }
  }
};

/**
 * Helper to run tests against multiple scenarios
 */
export function describeScenarios(
  description: string,
  scenarios: Array<keyof typeof testScenarios>,
  testFunction: (scenario: typeof testScenarios[keyof typeof testScenarios]) => void
) {
  scenarios.forEach(scenarioKey => {
    const scenario = testScenarios[scenarioKey];
    describe(`${description} - ${scenario.name}`, () => {
      testFunction(scenario);
    });
  });
}

/**
 * Assertion helpers for common test patterns
 */
export const assertions = {
  /**
   * Assert that an API client was called with expected parameters
   */
  expectApiCall: (
    mockFn: jest.MockedFunction<any>, 
    expectedArgs: any[],
    callIndex: number = 0
  ) => {
    expect(mockFn).toHaveBeenCalledWith(...expectedArgs);
    if (callIndex > 0) {
      expect(mockFn).toHaveBeenNthCalledWith(callIndex + 1, ...expectedArgs);
    }
  },

  /**
   * Assert that error handling was triggered correctly
   */
  expectErrorHandling: (
    mockFn: jest.MockedFunction<any>,
    expectedError: string | RegExp
  ) => {
    expect(mockFn).toHaveBeenCalled();
    const calls = mockFn.mock.calls;
    const lastCall = calls[calls.length - 1];
    if (typeof expectedError === 'string') {
      expect(lastCall[0]).toContain(expectedError);
    } else {
      expect(lastCall[0]).toMatch(expectedError);
    }
  },

  /**
   * Assert that rate limiting was handled correctly
   */
  expectRateLimitHandling: (mockClient: jest.Mocked<IGitHubApiClient>) => {
    expect(mockClient.getRateLimit).toHaveBeenCalled();
  }
};

/**
 * Creates a test suite for a GitHub service with standard scenarios
 */
export function createServiceTestSuite(
  serviceName: string,
  serviceFactory: (client: jest.Mocked<IGitHubApiClient>) => any,
  testCases: {
    method: string;
    args: any[];
    expectation: (result: any) => void;
    scenarios?: Array<keyof typeof testScenarios>;
  }[]
) {
  return () => {
    let mockClient: jest.Mocked<IGitHubApiClient>;
    let service: any;

    beforeEach(() => {
      mockClient = createMockGitHubApiClient();
      service = serviceFactory(mockClient);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    testCases.forEach(({ method, args, expectation, scenarios = ['successfulOperations'] }) => {
      describeScenarios(`${method}()`, scenarios, (scenario) => {
        it(`should handle ${scenario.name} correctly`, async () => {
          scenario.setup(mockClient);
          
          if (scenario.name.includes('error')) {
            await expect(service[method](...args)).rejects.toThrow();
          } else {
            const result = await service[method](...args);
            expectation(result);
          }
        });
      });
    });
  };
}

/**
 * Performance testing helpers
 */
export const performanceHelpers = {
  /**
   * Measures execution time of an async function
   */
  measureExecutionTime: async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  },

  /**
   * Creates a large dataset for performance testing
   */
  createLargeDataset: (size: number) => {
    return Array(size).fill(0).map((_, i) => ({
      ...githubApiFixtures.commits.standard,
      sha: `commit${i}sha`,
      commit: {
        ...githubApiFixtures.commits.standard.commit,
        message: `Commit ${i}: test commit for performance testing`
      }
    }));
  }
};

/**
 * Integration testing helpers
 */
export const integrationHelpers = {
  /**
   * Creates a test environment that simulates real API interactions
   */
  createIntegrationTestEnvironment: () => {
    const responses = new Map<string, any>();
    
    const mockFetch = jest.fn((url: string) => {
      const response = responses.get(url);
      if (response) {
        return Promise.resolve(createMockResponse(response));
      }
      return Promise.resolve(createMockResponse(githubApiFixtures.errors.notFound, 404));
    });

    global.fetch = mockFetch as any;

    return {
      setResponse: (url: string, data: any) => responses.set(url, data),
      clearResponses: () => responses.clear(),
      getCallCount: () => mockFetch.mock.calls.length,
      getLastCall: () => mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
    };
  }
};

export { githubApiFixtures } from './githubApiFixtures'; 