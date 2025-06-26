/**
 * Tests for GitHub Diff Service
 * 
 * Testing the diff retrieval service with mocked GitHub API client
 * to verify proper handling of diff data transformation and error cases.
 */

import {
  GitHubDiffService,
  createDiffService,
  DiffUtils,
  type IDiffService,
  type DiffReference,
  type DiffOptions,
} from '@/lib/github/diff-service';
import type { IGitHubApiClient } from '@/lib/github/api-client';

// Mock GitHub API client
const createMockGitHubClient = (): jest.Mocked<IGitHubApiClient> => ({
  getCommit: jest.fn(),
  getCommitDiff: jest.fn(),
  getRepository: jest.fn(),
  getRateLimit: jest.fn(),
});

// Mock fetch for raw diff testing
global.fetch = jest.fn();

describe('GitHubDiffService', () => {
  let mockApiClient: jest.Mocked<IGitHubApiClient>;
  let diffService: IDiffService;

  beforeEach(() => {
    mockApiClient = createMockGitHubClient();
    diffService = new GitHubDiffService(mockApiClient);
    jest.clearAllMocks();
  });

  describe('getDiff', () => {
    const mockDiffReference: DiffReference = {
      owner: 'testowner',
      repo: 'testrepo',
      base: 'main',
      head: 'feature-branch',
    };

    it('should successfully fetch and transform diff data', async () => {
      const mockComparisonData = {
        files: [
          {
            filename: 'src/test.ts',
            status: 'modified',
            additions: 10,
            deletions: 5,
            changes: 15,
            patch: '@@ -1,3 +1,3 @@\n test content',
            previous_filename: undefined,
            sha: 'abc123',
            blob_url: 'https://github.com/testowner/testrepo/blob/abc123/src/test.ts',
            raw_url: 'https://github.com/testowner/testrepo/raw/abc123/src/test.ts',
          },
        ],
        commits: [
          {
            sha: 'commit1',
            commit: {
              message: 'Add new feature',
              author: { name: 'Test Author', date: '2023-01-01T12:00:00Z' },
            },
            author: { login: 'testauthor' },
          },
        ],
        base_commit: { sha: 'base123' },
        head_commit: { sha: 'head456' },
        ahead_by: 2,
        behind_by: 0,
      };

      mockApiClient.getCommitDiff.mockResolvedValue(mockComparisonData as any);

      const result = await diffService.getDiff(mockDiffReference);

      expect(mockApiClient.getCommitDiff).toHaveBeenCalledWith('testowner', 'testrepo', 'main', 'feature-branch');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].filename).toBe('src/test.ts');
      expect(result.stats.additions).toBe(10);
      expect(result.stats.deletions).toBe(5);
      expect(result.commits[0].sha).toBe('commit1');
      expect(result.status).toBe('ahead');
    });

    it('should handle options with maxFiles limit', async () => {
      const mockData = {
        files: [{ filename: 'file1.ts' }, { filename: 'file2.ts' }],
        commits: [],
        base_commit: { sha: 'base' },
        head_commit: { sha: 'head' },
        ahead_by: 0,
        behind_by: 0,
      };
      mockApiClient.getCommitDiff.mockResolvedValue(mockData as any);

      const options: DiffOptions = { maxFiles: 1 };
      const result = await diffService.getDiff(mockDiffReference, options);

      expect(result.files).toHaveLength(1);
    });

    it('should handle options to exclude patches', async () => {
      const mockData = {
        files: [{ filename: 'file1.ts', patch: 'test patch' }],
        commits: [],
        base_commit: { sha: 'base' },
        head_commit: { sha: 'head' },
        ahead_by: 0,
        behind_by: 0,
      };
      mockApiClient.getCommitDiff.mockResolvedValue(mockData as any);

      const options: DiffOptions = { includePatches: false };
      const result = await diffService.getDiff(mockDiffReference, options);

      expect(result.files[0].patch).toBeUndefined();
    });

    it('should handle empty comparison data', async () => {
      const emptyComparison = {
        files: [],
        commits: [],
        base_commit: null,
        head_commit: null,
        ahead_by: 0,
        behind_by: 0,
      };
      mockApiClient.getCommitDiff.mockResolvedValue(emptyComparison as any);

      const result = await diffService.getDiff(mockDiffReference);

      expect(result.files).toEqual([]);
      expect(result.status).toBe('identical');
    });

    it('should determine correct status for different scenarios', async () => {
      const scenarios = [
        { ahead_by: 0, behind_by: 0, expected: 'identical' },
        { ahead_by: 2, behind_by: 0, expected: 'ahead' },
        { ahead_by: 0, behind_by: 1, expected: 'behind' },
        { ahead_by: 2, behind_by: 1, expected: 'diverged' },
      ];

      for (const scenario of scenarios) {
        const testComparison = {
          files: [],
          commits: [],
          base_commit: { sha: 'base' },
          head_commit: { sha: 'head' },
          ahead_by: scenario.ahead_by,
          behind_by: scenario.behind_by,
        };
        mockApiClient.getCommitDiff.mockResolvedValue(testComparison as any);

        const result = await diffService.getDiff(mockDiffReference);
        expect(result.status).toBe(scenario.expected);
      }
    });

    it('should throw error when API call fails', async () => {
      const apiError = new Error('API request failed');
      mockApiClient.getCommitDiff.mockRejectedValue(apiError);

      await expect(diffService.getDiff(mockDiffReference))
        .rejects.toThrow('Failed to fetch diff for main..feature-branch: API request failed');
    });
  });

  describe('getDiffRaw', () => {
    const mockDiffReference: DiffReference = {
      owner: 'testowner',
      repo: 'testrepo',
      base: 'main',
      head: 'feature-branch',
    };

    beforeEach(() => {
      process.env.GITHUB_TOKEN = 'test-token';
    });

    afterEach(() => {
      delete process.env.GITHUB_TOKEN;
    });

    it('should fetch raw diff successfully', async () => {
      const mockRawDiff = 'diff --git a/test.txt b/test.txt\n+new content';
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRawDiff),
      });

      const result = await diffService.getDiffRaw(mockDiffReference);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/testowner/testrepo/compare/main...feature-branch',
        {
          headers: {
            'Accept': 'application/vnd.github.v3.diff',
            'Authorization': 'token test-token',
            'User-Agent': 'change-reel/1.0.0',
          },
        }
      );
      expect(result).toBe(mockRawDiff);
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(diffService.getDiffRaw(mockDiffReference))
        .rejects.toThrow('Failed to fetch raw diff for main..feature-branch: HTTP 404: Not Found');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(diffService.getDiffRaw(mockDiffReference))
        .rejects.toThrow('Failed to fetch raw diff for main..feature-branch: Network error');
    });
  });

  describe('getDiffStats', () => {
    const mockDiffReference: DiffReference = {
      owner: 'testowner',
      repo: 'testrepo',
      base: 'main',
      head: 'feature-branch',
    };

    it('should calculate diff stats correctly', async () => {
      const mockComparison = {
        files: [
          { additions: 10, deletions: 5, changes: 15 },
          { additions: 20, deletions: 0, changes: 20 },
          { additions: 0, deletions: 3, changes: 3 },
        ],
      };
      mockApiClient.getCommitDiff.mockResolvedValue(mockComparison as any);

      const result = await diffService.getDiffStats(mockDiffReference);

      expect(result).toEqual({
        total_files: 3,
        additions: 30,
        deletions: 8,
        total_changes: 38,
      });
    });

    it('should handle missing file data', async () => {
      const mockComparison = { files: null };
      mockApiClient.getCommitDiff.mockResolvedValue(mockComparison as any);

      const result = await diffService.getDiffStats(mockDiffReference);

      expect(result).toEqual({
        total_files: 0,
        additions: 0,
        deletions: 0,
        total_changes: 0,
      });
    });

    it('should throw error when API call fails', async () => {
      const apiError = new Error('API request failed');
      mockApiClient.getCommitDiff.mockRejectedValue(apiError);

      await expect(diffService.getDiffStats(mockDiffReference))
        .rejects.toThrow('Failed to fetch diff stats for main..feature-branch: API request failed');
    });
  });

  describe('validateDiffReference', () => {
    const mockDiffReference: DiffReference = {
      owner: 'testowner',
      repo: 'testrepo',
      base: 'main',
      head: 'feature-branch',
    };

    it('should return true when diff reference is valid', async () => {
      mockApiClient.getCommitDiff.mockResolvedValue({} as any);

      const result = await diffService.validateDiffReference(mockDiffReference);

      expect(result).toBe(true);
    });

    it('should return false for invalid reference errors', async () => {
      const invalidErrors = [
        new Error('GitHub API resource not found'),
        new Error('No common ancestor found'),
        new Error('Branch not found'),
      ];

      for (const error of invalidErrors) {
        mockApiClient.getCommitDiff.mockRejectedValue(error);

        const result = await diffService.validateDiffReference(mockDiffReference);
        expect(result).toBe(false);
      }
    });

    it('should re-throw non-validation errors', async () => {
      const authError = new Error('Authentication failed');
      mockApiClient.getCommitDiff.mockRejectedValue(authError);

      await expect(diffService.validateDiffReference(mockDiffReference))
        .rejects.toThrow('Authentication failed');
    });
  });

  describe('Factory function', () => {
    it('should create service instance using factory function', () => {
      const service = createDiffService(mockApiClient);
      expect(service).toBeInstanceOf(GitHubDiffService);
    });
  });
});

describe('DiffUtils', () => {
  describe('parseUnifiedDiff', () => {
    it('should parse a simple unified diff', () => {
      const diffText = `diff --git a/test.txt b/test.txt
index 123..456
--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,3 @@
 line 1
-old line 2
+new line 2
 line 3`;

      const result = DiffUtils.parseUnifiedDiff(diffText);

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('test.txt');
      expect(result[0].hunks).toHaveLength(1);
      expect(result[0].hunks[0].lines).toHaveLength(4);
    });

    it('should handle multiple files', () => {
      const diffText = `diff --git a/file1.txt b/file1.txt
--- a/file1.txt
+++ b/file1.txt
@@ -1,1 +1,1 @@
-old content
+new content
diff --git a/file2.txt b/file2.txt
--- a/file2.txt
+++ b/file2.txt
@@ -1,1 +1,2 @@
 existing line
+added line`;

      const result = DiffUtils.parseUnifiedDiff(diffText);

      expect(result).toHaveLength(2);
      expect(result[0].filename).toBe('file1.txt');
      expect(result[1].filename).toBe('file2.txt');
    });

    it('should handle empty diff', () => {
      const result = DiffUtils.parseUnifiedDiff('');
      expect(result).toEqual([]);
    });
  });

  describe('calculateStats', () => {
    it('should calculate statistics correctly', () => {
      const parsedDiff = [
        {
          filename: 'test.txt',
          hunks: [
            {
              oldStart: 1,
              oldLines: 3,
              newStart: 1,
              newLines: 4,
              lines: [
                { type: 'context' as const, content: 'line 1' },
                { type: 'remove' as const, content: 'old line 2' },
                { type: 'add' as const, content: 'new line 2' },
                { type: 'add' as const, content: 'another new line' },
                { type: 'context' as const, content: 'line 3' },
              ],
            },
          ],
        },
      ];

      const result = DiffUtils.calculateStats(parsedDiff);

      expect(result).toEqual({
        total_files: 1,
        additions: 2,
        deletions: 1,
        total_changes: 3,
      });
    });

    it('should handle empty parsed diff', () => {
      const result = DiffUtils.calculateStats([]);

      expect(result).toEqual({
        total_files: 0,
        additions: 0,
        deletions: 0,
        total_changes: 0,
      });
    });
  });
}); 