/**
 * Tests for GitHub Commit Service
 * 
 * Testing the commit fetching service with mocked GitHub API client
 * to verify proper handling of commit data transformation and error cases.
 */

import {
  GitHubCommitService,
  createCommitService,
  type ICommitService,
  type CommitReference,
  type CommitDetails,
} from '@/lib/github/commit-service';
import type { IGitHubApiClient, GitHubCommit } from '@/lib/github/api-client';

// Mock GitHub API client
const createMockGitHubClient = (): jest.Mocked<IGitHubApiClient> => ({
  getCommit: jest.fn(),
  getCommitDiff: jest.fn(),
  getRepository: jest.fn(),
  getRateLimit: jest.fn(),
});

describe('GitHubCommitService', () => {
  let mockApiClient: jest.Mocked<IGitHubApiClient>;
  let commitService: ICommitService;

  beforeEach(() => {
    mockApiClient = createMockGitHubClient();
    commitService = new GitHubCommitService(mockApiClient);
  });

  describe('getCommitDetails', () => {
    const mockCommitReference: CommitReference = {
      owner: 'testowner',
      repo: 'testrepo',
      sha: 'abc123',
    };

    const mockGitHubCommit: GitHubCommit = {
      sha: 'abc123',
      commit: {
        message: 'Test commit message',
        author: {
          name: 'Test Author',
          email: 'test@example.com',
          date: '2023-01-01T12:00:00Z',
        },
        committer: {
          name: 'Test Committer',
          email: 'committer@example.com',
          date: '2023-01-01T12:00:00Z',
        },
      },
      html_url: 'https://github.com/testowner/testrepo/commit/abc123',
      stats: {
        additions: 10,
        deletions: 5,
        total: 15,
      },
      files: [
        {
          filename: 'test.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          changes: 15,
          patch: '@@ -1,3 +1,3 @@\n test content',
        },
        {
          filename: 'new-file.ts',
          status: 'added',
          additions: 20,
          deletions: 0,
          changes: 20,
          patch: '@@ -0,0 +1,20 @@\n new content',
        },
      ],
    } as GitHubCommit;

    it('should successfully fetch and transform commit details', async () => {
      mockApiClient.getCommit.mockResolvedValue(mockGitHubCommit);

      const result = await commitService.getCommitDetails(mockCommitReference);

      expect(mockApiClient.getCommit).toHaveBeenCalledWith('testowner', 'testrepo', 'abc123');
      expect(result).toEqual({
        sha: 'abc123',
        message: 'Test commit message',
        author: {
          name: 'Test Author',
          email: 'test@example.com',
          date: '2023-01-01T12:00:00Z',
        },
        committer: {
          name: 'Test Committer',
          email: 'committer@example.com',
          date: '2023-01-01T12:00:00Z',
        },
        url: 'https://github.com/testowner/testrepo/commit/abc123',
        stats: {
          additions: 10,
          deletions: 5,
          total: 15,
        },
        files: [
          {
            filename: 'test.ts',
            status: 'modified',
            additions: 10,
            deletions: 5,
            changes: 15,
            patch: '@@ -1,3 +1,3 @@\n test content',
            previous_filename: undefined,
          },
          {
            filename: 'new-file.ts',
            status: 'added',
            additions: 20,
            deletions: 0,
            changes: 20,
            patch: '@@ -0,0 +1,20 @@\n new content',
            previous_filename: undefined,
          },
        ],
      });
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalCommit = {
        sha: 'abc123',
        commit: {
          message: 'Minimal commit',
          author: null,
          committer: null,
        },
        html_url: '',
        stats: null,
        files: [],
      } as any;

      mockApiClient.getCommit.mockResolvedValue(minimalCommit);

      const result = await commitService.getCommitDetails(mockCommitReference);

      expect(result).toEqual({
        sha: 'abc123',
        message: 'Minimal commit',
        author: {
          name: 'Unknown',
          email: '',
          date: '',
        },
        committer: {
          name: 'Unknown',
          email: '',
          date: '',
        },
        url: '',
        stats: {
          additions: 0,
          deletions: 0,
          total: 0,
        },
        files: [],
      });
    });

    it('should throw error when API call fails', async () => {
      const apiError = new Error('API request failed');
      mockApiClient.getCommit.mockRejectedValue(apiError);

      await expect(commitService.getCommitDetails(mockCommitReference))
        .rejects.toThrow('Failed to fetch commit details for abc123: API request failed');
    });

    it('should handle non-Error exceptions', async () => {
      mockApiClient.getCommit.mockRejectedValue('String error');

      await expect(commitService.getCommitDetails(mockCommitReference))
        .rejects.toThrow('Failed to fetch commit details for abc123: String error');
    });
  });

  describe('getCommitsByRange', () => {
    const mockComparisonData = {
      commits: [
        { sha: 'commit1' },
        { sha: 'commit2' },
      ],
    } as any;

    const mockCommitDetails: CommitDetails = {
      sha: 'commit1',
      message: 'Test commit',
      author: { name: 'Author', email: 'author@test.com', date: '2023-01-01T12:00:00Z' },
      committer: { name: 'Committer', email: 'committer@test.com', date: '2023-01-01T12:00:00Z' },
      url: 'https://github.com/owner/repo/commit/commit1',
      stats: { additions: 5, deletions: 2, total: 7 },
      files: [],
    };

    it('should successfully fetch commits in range', async () => {
      mockApiClient.getCommitDiff.mockResolvedValue(mockComparisonData);
      
      // Mock getCommitDetails calls
      jest.spyOn(commitService, 'getCommitDetails')
        .mockResolvedValueOnce({ ...mockCommitDetails, sha: 'commit1' })
        .mockResolvedValueOnce({ ...mockCommitDetails, sha: 'commit2' });

      const result = await commitService.getCommitsByRange('owner', 'repo', 'base', 'head');

      expect(mockApiClient.getCommitDiff).toHaveBeenCalledWith('owner', 'repo', 'base', 'head');
      expect(result).toHaveLength(2);
      expect(result[0].sha).toBe('commit1');
      expect(result[1].sha).toBe('commit2');
    });

    it('should handle empty commit list', async () => {
      const emptyComparison = { commits: [] } as any;
      mockApiClient.getCommitDiff.mockResolvedValue(emptyComparison);

      const result = await commitService.getCommitsByRange('owner', 'repo', 'base', 'head');

      expect(result).toEqual([]);
    });

    it('should handle missing commits property', async () => {
      const noCommitsComparison = {} as any;
      mockApiClient.getCommitDiff.mockResolvedValue(noCommitsComparison);

      const result = await commitService.getCommitsByRange('owner', 'repo', 'base', 'head');

      expect(result).toEqual([]);
    });

    it('should throw error when comparison fails', async () => {
      const apiError = new Error('Comparison failed');
      mockApiClient.getCommitDiff.mockRejectedValue(apiError);

      await expect(commitService.getCommitsByRange('owner', 'repo', 'base', 'head'))
        .rejects.toThrow('Failed to fetch commits in range base..head: Comparison failed');
    });
  });

  describe('validateCommitExists', () => {
    const mockCommitReference: CommitReference = {
      owner: 'testowner',
      repo: 'testrepo',
      sha: 'abc123',
    };

    it('should return true when commit exists', async () => {
      mockApiClient.getCommit.mockResolvedValue({} as any);

      const result = await commitService.validateCommitExists(mockCommitReference);

      expect(result).toBe(true);
      expect(mockApiClient.getCommit).toHaveBeenCalledWith('testowner', 'testrepo', 'abc123');
    });

    it('should return false when commit is not found', async () => {
      const notFoundError = new Error('GitHub API resource not found');
      mockApiClient.getCommit.mockRejectedValue(notFoundError);

      const result = await commitService.validateCommitExists(mockCommitReference);

      expect(result).toBe(false);
    });

    it('should re-throw non-404 errors', async () => {
      const authError = new Error('Authentication failed');
      mockApiClient.getCommit.mockRejectedValue(authError);

      await expect(commitService.validateCommitExists(mockCommitReference))
        .rejects.toThrow('Authentication failed');
    });

    it('should handle non-Error exceptions', async () => {
      mockApiClient.getCommit.mockRejectedValue('String error');

      await expect(commitService.validateCommitExists(mockCommitReference))
        .rejects.toBe('String error');
    });
  });

  describe('Factory function', () => {
    it('should create service instance using factory function', () => {
      const service = createCommitService(mockApiClient);
      expect(service).toBeInstanceOf(GitHubCommitService);
    });
  });
}); 