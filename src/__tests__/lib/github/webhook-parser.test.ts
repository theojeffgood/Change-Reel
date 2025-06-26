/**
 * Tests for GitHub Webhook Parser
 * 
 * Tests the parsing logic for various GitHub webhook event types
 */

import { GitHubWebhookParser } from '@/lib/github/webhook-parser';
import {
  pushEventPayload,
  multipleCommitsPushPayload,
  pullRequestEventPayload,
  releaseEventPayload,
} from '@/__tests__/fixtures/webhookFixtures';

describe('GitHubWebhookParser', () => {
  describe('parseWebhookPayload', () => {
    it('should parse push events correctly', () => {
      const result = GitHubWebhookParser.parseWebhookPayload('push', multipleCommitsPushPayload);

      expect(result.success).toBe(true);
      expect(result.event_type).toBe('push');
      expect(result.repository.name).toBe('test-repo');
      expect(result.repository.full_name).toBe('testuser/test-repo');
      expect(result.branch).toBe('main');
      expect(result.commits).toHaveLength(3);

      // Check first commit
      const firstCommit = result.commits![0];
      expect(firstCommit.sha).toBe('commit1sha');
      expect(firstCommit.message).toBe('fix: resolve login bug');
      expect(firstCommit.author_name).toBe('Developer One');
      expect(firstCommit.author_email).toBe('dev1@example.com');
      expect(firstCommit.branch).toBe('main');
    });

    it('should parse single commit push events', () => {
      const result = GitHubWebhookParser.parseWebhookPayload('push', pushEventPayload);

      expect(result.success).toBe(true);
      expect(result.event_type).toBe('push');
      expect(result.commits).toHaveLength(1);

      const commit = result.commits![0];
      expect(commit.sha).toBe('def456ghi789');
      expect(commit.message).toBe('feat: add user authentication system');
      expect(commit.author_name).toBe('Test User');
      expect(commit.author_email).toBe('testuser@example.com');
      expect(commit.files_added).toEqual(['src/auth.js', 'tests/auth.test.js']);
      expect(commit.files_modified).toEqual(['package.json', 'README.md']);
      expect(commit.files_removed).toEqual([]);
    });

    it('should handle deleted branches in push events', () => {
      const deletedBranchPayload = {
        ...pushEventPayload,
        deleted: true,
        commits: [],
      };

      const result = GitHubWebhookParser.parseWebhookPayload('push', deletedBranchPayload);

      expect(result.success).toBe(true);
      expect(result.commits).toHaveLength(0);
    });

    it('should handle tag pushes', () => {
      const tagPushPayload = {
        ...pushEventPayload,
        ref: 'refs/tags/v1.0.0',
        commits: [],
      };

      const result = GitHubWebhookParser.parseWebhookPayload('push', tagPushPayload);

      expect(result.success).toBe(true);
      expect(result.commits).toHaveLength(0);
    });

    it('should parse pull request events', () => {
      const result = GitHubWebhookParser.parseWebhookPayload('pull_request', pullRequestEventPayload);

      expect(result.success).toBe(true);
      expect(result.event_type).toBe('pull_request');
      expect(result.repository.name).toBe('test-repo');
      expect(result.commits).toHaveLength(0); // PRs don't extract commits yet
    });

    it('should parse release events', () => {
      const result = GitHubWebhookParser.parseWebhookPayload('release', releaseEventPayload);

      expect(result.success).toBe(true);
      expect(result.event_type).toBe('release');
      expect(result.repository.name).toBe('test-repo');
      expect(result.commits).toHaveLength(0); // Releases don't extract commits yet
    });

    it('should handle unknown event types gracefully', () => {
      const result = GitHubWebhookParser.parseWebhookPayload('unknown_event', pushEventPayload);

      expect(result.success).toBe(true);
      expect(result.event_type).toBe('unknown_event');
      expect(result.commits).toHaveLength(0);
    });

    it('should handle malformed payloads', () => {
      const malformedPayload = {
        // Missing repository and other required fields
        ref: 'refs/heads/main',
      };

      const result = GitHubWebhookParser.parseWebhookPayload('push', malformedPayload);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validatePayload', () => {
    it('should validate correct push payload', () => {
      const validation = GitHubWebhookParser.validatePayload('push', pushEventPayload);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing repository information', () => {
      const invalidPayload = {
        ref: 'refs/heads/main',
        commits: [],
        // Missing repository
      };

      const validation = GitHubWebhookParser.validatePayload('push', invalidPayload);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing repository information');
    });

    it('should detect missing ref in push events', () => {
      const invalidPayload = {
        repository: pushEventPayload.repository,
        commits: [],
        // Missing ref
      };

      const validation = GitHubWebhookParser.validatePayload('push', invalidPayload);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing ref in push event');
    });

    it('should detect invalid commits array in push events', () => {
      const invalidPayload = {
        repository: pushEventPayload.repository,
        ref: 'refs/heads/main',
        commits: 'not an array', // Invalid commits
      };

      const validation = GitHubWebhookParser.validatePayload('push', invalidPayload);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing or invalid commits array');
    });

    it('should validate pull request payloads', () => {
      const validation = GitHubWebhookParser.validatePayload('pull_request', pullRequestEventPayload);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing pull_request data', () => {
      const invalidPayload = {
        repository: pullRequestEventPayload.repository,
        // Missing pull_request
      };

      const validation = GitHubWebhookParser.validatePayload('pull_request', invalidPayload);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing pull_request data');
    });
  });

  describe('shouldProcessEvent', () => {
    it('should process normal push events', () => {
      const shouldProcess = GitHubWebhookParser.shouldProcessEvent('push', pushEventPayload);

      expect(shouldProcess).toBe(true);
    });

    it('should skip deleted branches', () => {
      const deletedBranchPayload = {
        ...pushEventPayload,
        deleted: true,
      };

      const shouldProcess = GitHubWebhookParser.shouldProcessEvent('push', deletedBranchPayload);

      expect(shouldProcess).toBe(false);
    });

    it('should skip tag pushes', () => {
      const tagPushPayload = {
        ...pushEventPayload,
        ref: 'refs/tags/v1.0.0',
      };

      const shouldProcess = GitHubWebhookParser.shouldProcessEvent('push', tagPushPayload);

      expect(shouldProcess).toBe(false);
    });

    it('should process merged pull requests', () => {
      const mergedPRPayload = {
        action: 'closed',
        pull_request: {
          merged: true,
        },
      };

      const shouldProcess = GitHubWebhookParser.shouldProcessEvent('pull_request', mergedPRPayload);

      expect(shouldProcess).toBe(true);
    });

    it('should skip non-merged pull requests', () => {
      const closedPRPayload = {
        action: 'closed',
        pull_request: {
          merged: false,
        },
      };

      const shouldProcess = GitHubWebhookParser.shouldProcessEvent('pull_request', closedPRPayload);

      expect(shouldProcess).toBe(false);
    });

    it('should process published releases', () => {
      const publishedReleasePayload = {
        action: 'published',
        release: {},
      };

      const shouldProcess = GitHubWebhookParser.shouldProcessEvent('release', publishedReleasePayload);

      expect(shouldProcess).toBe(true);
    });

    it('should skip draft releases', () => {
      const draftReleasePayload = {
        action: 'created',
        release: {},
      };

      const shouldProcess = GitHubWebhookParser.shouldProcessEvent('release', draftReleasePayload);

      expect(shouldProcess).toBe(false);
    });

    it('should skip unknown event types', () => {
      const shouldProcess = GitHubWebhookParser.shouldProcessEvent('unknown_event', {});

      expect(shouldProcess).toBe(false);
    });
  });

  describe('extractBranchFromRef', () => {
    it('should extract branch name from refs/heads/ format', () => {
      // This is a private method, so we'll test it through parseWebhookPayload
      const payload = {
        ...pushEventPayload,
        ref: 'refs/heads/feature/new-branch',
      };

      const result = GitHubWebhookParser.parseWebhookPayload('push', payload);

      expect(result.branch).toBe('feature/new-branch');
    });

    it('should handle non-standard ref formats', () => {
      const payload = {
        ...pushEventPayload,
        ref: 'main', // Not in refs/heads/ format
      };

      const result = GitHubWebhookParser.parseWebhookPayload('push', payload);

      expect(result.branch).toBe('main');
    });
  });
}); 