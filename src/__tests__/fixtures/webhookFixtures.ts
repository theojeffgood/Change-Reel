/**
 * GitHub Webhook Test Fixtures
 * 
 * Realistic webhook payloads for testing webhook processing logic.
 * Based on GitHub's webhook event payloads documentation.
 */

export interface GitHubWebhookHeaders {
  'x-github-event': string;
  'x-github-delivery': string;
  'x-hub-signature-256': string;
  'content-type': string;
  'user-agent': string;
  [key: string]: string; // Index signature to allow assignment to Record<string, string>
}

// Sample headers for GitHub webhooks
export const sampleWebhookHeaders: GitHubWebhookHeaders = {
  'x-github-event': 'push',
  'x-github-delivery': '12345678-1234-1234-1234-123456789012',
  'x-hub-signature-256': 'sha256=example_signature',
  'content-type': 'application/json',
  'user-agent': 'GitHub-Hookshot/abc123'
};

// Push event payload (main event we process)
export const pushEventPayload = {
  ref: 'refs/heads/main',
  before: 'abc123def456',
  after: 'def456ghi789',
  repository: {
    id: 123456789,
    name: 'test-repo',
    full_name: 'testuser/test-repo',
    owner: {
      name: 'testuser',
      login: 'testuser'
    },
    clone_url: 'https://github.com/testuser/test-repo.git',
    html_url: 'https://github.com/testuser/test-repo'
  },
  pusher: {
    name: 'testuser',
    email: 'testuser@example.com'
  },
  commits: [
    {
      id: 'def456ghi789',
      message: 'feat: add user authentication system',
      author: {
        name: 'Test User',
        email: 'testuser@example.com'
      },
      committer: {
        name: 'Test User',
        email: 'testuser@example.com'
      },
      timestamp: '2025-06-26T10:00:00Z',
      url: 'https://github.com/testuser/test-repo/commit/def456ghi789',
      added: ['src/auth.js', 'tests/auth.test.js'],
      removed: [],
      modified: ['package.json', 'README.md']
    }
  ],
  head_commit: {
    id: 'def456ghi789',
    message: 'feat: add user authentication system',
    author: {
      name: 'Test User',
      email: 'testuser@example.com'
    },
    committer: {
      name: 'Test User',
      email: 'testuser@example.com'
    },
    timestamp: '2025-06-26T10:00:00Z',
    url: 'https://github.com/testuser/test-repo/commit/def456ghi789'
  }
};

// Multiple commits push event
export const multipleCommitsPushPayload = {
  ...pushEventPayload,
  commits: [
    {
      id: 'commit1sha',
      message: 'fix: resolve login bug',
      author: {
        name: 'Developer One',
        email: 'dev1@example.com'
      },
      committer: {
        name: 'Developer One',
        email: 'dev1@example.com'
      },
      timestamp: '2025-06-26T09:00:00Z',
      url: 'https://github.com/testuser/test-repo/commit/commit1sha'
    },
    {
      id: 'commit2sha',
      message: 'refactor: improve error handling',
      author: {
        name: 'Developer Two',
        email: 'dev2@example.com'
      },
      committer: {
        name: 'Developer Two',
        email: 'dev2@example.com'
      },
      timestamp: '2025-06-26T09:30:00Z',
      url: 'https://github.com/testuser/test-repo/commit/commit2sha'
    },
    {
      id: 'commit3sha',
      message: 'chore: update dependencies',
      author: {
        name: 'Developer Three',
        email: 'dev3@example.com'
      },
      committer: {
        name: 'Developer Three',
        email: 'dev3@example.com'
      },
      timestamp: '2025-06-26T10:00:00Z',
      url: 'https://github.com/testuser/test-repo/commit/commit3sha'
    }
  ],
  head_commit: {
    id: 'commit3sha',
    message: 'chore: update dependencies',
    author: {
      name: 'Developer Three',
      email: 'dev3@example.com'
    },
    committer: {
      name: 'Developer Three',
      email: 'dev3@example.com'
    },
    timestamp: '2025-06-26T10:00:00Z',
    url: 'https://github.com/testuser/test-repo/commit/commit3sha'
  }
};

// Pull request event (should be filtered out)
export const pullRequestEventPayload = {
  action: 'opened',
  number: 123,
  pull_request: {
    id: 987654321,
    title: 'Add new feature',
    body: 'This PR adds a new feature',
    head: {
      ref: 'feature-branch',
      sha: 'featurebranch123'
    },
    base: {
      ref: 'main',
      sha: 'mainbranch456'
    }
  },
  repository: pushEventPayload.repository
};

// Release event (should be filtered out)
export const releaseEventPayload = {
  action: 'published',
  release: {
    id: 111222333,
    tag_name: 'v1.0.0',
    name: 'Version 1.0.0',
    body: 'First stable release'
  },
  repository: pushEventPayload.repository
};

// Branch deletion event (should be filtered out)
export const deleteEventPayload = {
  ref: 'feature-branch',
  ref_type: 'branch',
  repository: pushEventPayload.repository,
  pusher: pushEventPayload.pusher
};

// Invalid payload (malformed JSON)
export const invalidPayload = {
  invalid: 'payload',
  missing: 'required_fields'
};

// Empty commits push (should be handled gracefully)
export const emptyCommitsPushPayload = {
  ...pushEventPayload,
  commits: [],
  head_commit: null
};

// Push to non-main branch (configurable whether to process)
export const branchPushPayload = {
  ...pushEventPayload,
  ref: 'refs/heads/feature-branch',
  commits: [
    {
      id: 'branchcommit123',
      message: 'feat: working on new feature',
      author: {
        name: 'Feature Developer',
        email: 'feature@example.com'
      },
      committer: {
        name: 'Feature Developer',
        email: 'feature@example.com'
      },
      timestamp: '2025-06-26T11:00:00Z',
      url: 'https://github.com/testuser/test-repo/commit/branchcommit123'
    }
  ]
};

// Helper function to create webhook signature
export function createWebhookSignature(payload: string, secret: string): string {
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

// Helper function to create headers with proper signature
export function createWebhookHeaders(
  eventType: string,
  payload: string,
  secret: string = 'test-secret'
): GitHubWebhookHeaders {
  return {
    'x-github-event': eventType,
    'x-github-delivery': '12345678-1234-1234-1234-123456789012',
    'x-hub-signature-256': createWebhookSignature(payload, secret),
    'content-type': 'application/json',
    'user-agent': 'GitHub-Hookshot/abc123'
  };
}

// Test scenarios for comprehensive testing
export const testScenarios = {
  validPushEvent: {
    headers: createWebhookHeaders('push', JSON.stringify(pushEventPayload)),
    payload: pushEventPayload,
    expectedResult: 'processed'
  },
  multipleCommits: {
    headers: createWebhookHeaders('push', JSON.stringify(multipleCommitsPushPayload)),
    payload: multipleCommitsPushPayload,
    expectedResult: 'processed'
  },
  pullRequestEvent: {
    headers: createWebhookHeaders('pull_request', JSON.stringify(pullRequestEventPayload)),
    payload: pullRequestEventPayload,
    expectedResult: 'filtered_out'
  },
  releaseEvent: {
    headers: createWebhookHeaders('release', JSON.stringify(releaseEventPayload)),
    payload: releaseEventPayload,
    expectedResult: 'filtered_out'
  },
  deleteEvent: {
    headers: createWebhookHeaders('delete', JSON.stringify(deleteEventPayload)),
    payload: deleteEventPayload,
    expectedResult: 'filtered_out'
  },
  emptyCommits: {
    headers: createWebhookHeaders('push', JSON.stringify(emptyCommitsPushPayload)),
    payload: emptyCommitsPushPayload,
    expectedResult: 'ignored'
  },
  branchPush: {
    headers: createWebhookHeaders('push', JSON.stringify(branchPushPayload)),
    payload: branchPushPayload,
    expectedResult: 'configurable'
  },
  invalidSignature: {
    headers: {
      ...createWebhookHeaders('push', JSON.stringify(pushEventPayload)),
      'x-hub-signature-256': 'sha256=invalid_signature'
    },
    payload: pushEventPayload,
    expectedResult: 'rejected'
  },
  malformedPayload: {
    headers: createWebhookHeaders('push', JSON.stringify(invalidPayload)),
    payload: invalidPayload,
    expectedResult: 'error'
  }
};

export default {
  sampleWebhookHeaders,
  pushEventPayload,
  multipleCommitsPushPayload,
  pullRequestEventPayload,
  releaseEventPayload,
  deleteEventPayload,
  invalidPayload,
  emptyCommitsPushPayload,
  branchPushPayload,
  createWebhookSignature,
  createWebhookHeaders,
  testScenarios
}; 