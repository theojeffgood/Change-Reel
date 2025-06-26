/**
 * GitHub API Test Fixtures
 * 
 * Realistic GitHub API responses for testing our GitHub integration services.
 * Based on GitHub's REST API v4 documentation and real API responses.
 */

// Repository data fixture
export const repositoryFixture = {
  id: 123456789,
  node_id: 'MDEwOlJlcG9zaXRvcnkxMjM0NTY3ODk=',
  name: 'test-repo',
  full_name: 'testuser/test-repo',
  owner: {
    login: 'testuser',
    id: 987654321,
    node_id: 'MDQ6VXNlcjk4NzY1NDMyMQ==',
    avatar_url: 'https://github.com/images/error/testuser_happy.gif',
    gravatar_id: '',
    url: 'https://api.github.com/users/testuser',
    html_url: 'https://github.com/testuser',
    type: 'User',
    site_admin: false
  },
  private: false,
  html_url: 'https://github.com/testuser/test-repo',
  description: 'A test repository for the Change Reel project',
  fork: false,
  url: 'https://api.github.com/repos/testuser/test-repo',
  clone_url: 'https://github.com/testuser/test-repo.git',
  git_url: 'git://github.com/testuser/test-repo.git',
  ssh_url: 'git@github.com:testuser/test-repo.git',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-06-26T12:00:00Z',
  pushed_at: '2025-06-26T12:00:00Z',
  size: 1024,
  stargazers_count: 42,
  watchers_count: 42,
  language: 'TypeScript',
  has_issues: true,
  has_projects: true,
  has_wiki: true,
  has_pages: false,
  forks_count: 5,
  archived: false,
  disabled: false,
  open_issues_count: 3,
  license: {
    key: 'mit',
    name: 'MIT License',
    spdx_id: 'MIT',
    url: 'https://api.github.com/licenses/mit',
    node_id: 'MDc6TGljZW5zZW1pdA=='
  },
  allow_forking: true,
  is_template: false,
  web_commit_signoff_required: false,
  topics: ['typescript', 'changelog', 'automation'],
  visibility: 'public',
  forks: 5,
  open_issues: 3,
  watchers: 42,
  default_branch: 'main',
  permissions: {
    admin: true,
    maintain: true,
    push: true,
    triage: true,
    pull: true
  }
};

// Private repository fixture
export const privateRepositoryFixture = {
  ...repositoryFixture,
  id: 987654321,
  name: 'private-repo',
  full_name: 'testuser/private-repo',
  private: true,
  html_url: 'https://github.com/testuser/private-repo',
  url: 'https://api.github.com/repos/testuser/private-repo',
  clone_url: 'https://github.com/testuser/private-repo.git',
  git_url: 'git://github.com/testuser/private-repo.git',
  ssh_url: 'git@github.com:testuser/private-repo.git',
  description: 'A private test repository',
  visibility: 'private'
};

// Single commit response fixture
export const commitFixture = {
  sha: 'abc123def456ghi789',
  node_id: 'MDY6Q29tbWl0MTIzNDU2Nzg5OmFiYzEyM2RlZjQ1NmdoaTc4OQ==',
  url: 'https://api.github.com/repos/testuser/test-repo/commits/abc123def456ghi789',
  html_url: 'https://github.com/testuser/test-repo/commit/abc123def456ghi789',
  comments_url: 'https://api.github.com/repos/testuser/test-repo/commits/abc123def456ghi789/comments',
  commit: {
    author: {
      name: 'Test User',
      email: 'testuser@example.com',
      date: '2025-06-26T10:00:00Z'
    },
    committer: {
      name: 'Test User',
      email: 'testuser@example.com',
      date: '2025-06-26T10:00:00Z'
    },
    message: 'feat: add user authentication system\n\nImplement JWT-based authentication with secure token storage and validation middleware.',
    tree: {
      sha: 'tree123abc456def',
      url: 'https://api.github.com/repos/testuser/test-repo/git/trees/tree123abc456def'
    },
    comment_count: 0,
    verification: {
      verified: false,
      reason: 'unsigned',
      signature: null,
      payload: null
    }
  },
  author: {
    login: 'testuser',
    id: 987654321,
    node_id: 'MDQ6VXNlcjk4NzY1NDMyMQ==',
    avatar_url: 'https://github.com/images/error/testuser_happy.gif',
    gravatar_id: '',
    url: 'https://api.github.com/users/testuser',
    html_url: 'https://github.com/testuser',
    type: 'User',
    site_admin: false
  },
  committer: {
    login: 'testuser',
    id: 987654321,
    node_id: 'MDQ6VXNlcjk4NzY1NDMyMQ==',
    avatar_url: 'https://github.com/images/error/testuser_happy.gif',
    gravatar_id: '',
    url: 'https://api.github.com/users/testuser',
    html_url: 'https://github.com/testuser',
    type: 'User',
    site_admin: false
  },
  parents: [
    {
      sha: 'parent123abc456',
      url: 'https://api.github.com/repos/testuser/test-repo/commits/parent123abc456',
      html_url: 'https://github.com/testuser/test-repo/commit/parent123abc456'
    }
  ],
  stats: {
    total: 15,
    additions: 12,
    deletions: 3
  },
  files: [
    {
      sha: 'file123abc456',
      filename: 'src/auth/jwt.ts',
      status: 'added',
      additions: 8,
      deletions: 0,
      changes: 8,
      blob_url: 'https://github.com/testuser/test-repo/blob/abc123def456ghi789/src/auth/jwt.ts',
      raw_url: 'https://github.com/testuser/test-repo/raw/abc123def456ghi789/src/auth/jwt.ts',
      contents_url: 'https://api.github.com/repos/testuser/test-repo/contents/src/auth/jwt.ts?ref=abc123def456ghi789',
      patch: '@@ -0,0 +1,8 @@\n+import jwt from \'jsonwebtoken\';\n+\n+export function generateToken(payload: any): string {\n+  return jwt.sign(payload, process.env.JWT_SECRET!);\n+}\n+\n+export function verifyToken(token: string): any {\n+  return jwt.verify(token, process.env.JWT_SECRET!);\n+}'
    },
    {
      sha: 'file456def789',
      filename: 'src/middleware/auth.ts',
      status: 'added',
      additions: 4,
      deletions: 0,
      changes: 4,
      blob_url: 'https://github.com/testuser/test-repo/blob/abc123def456ghi789/src/middleware/auth.ts',
      raw_url: 'https://github.com/testuser/test-repo/raw/abc123def456ghi789/src/middleware/auth.ts',
      contents_url: 'https://api.github.com/repos/testuser/test-repo/contents/src/middleware/auth.ts?ref=abc123def456ghi789',
      patch: '@@ -0,0 +1,4 @@\n+import { verifyToken } from \'../auth/jwt\';\n+\n+export function authMiddleware(req: any, res: any, next: any) {\n+  // Auth middleware implementation\n+}'
    },
    {
      sha: 'file789ghi012',
      filename: 'package.json',
      status: 'modified',
      additions: 0,
      deletions: 3,
      changes: 3,
      blob_url: 'https://github.com/testuser/test-repo/blob/abc123def456ghi789/package.json',
      raw_url: 'https://github.com/testuser/test-repo/raw/abc123def456ghi789/package.json',
      contents_url: 'https://api.github.com/repos/testuser/test-repo/contents/package.json?ref=abc123def456ghi789',
      patch: '@@ -10,9 +10,6 @@\n   "dependencies": {\n     "express": "^4.18.0",\n-    "old-auth-lib": "^1.0.0",\n-    "deprecated-middleware": "^0.5.0",\n-    "unused-package": "^2.1.0"\n+    "jsonwebtoken": "^9.0.0"\n   }\n }'
    }
  ]
};

// Commit with large changes (should trigger noise filtering)
export const largeCommitFixture = {
  ...commitFixture,
  sha: 'large123def456ghi789',
  commit: {
    ...commitFixture.commit,
    message: 'chore: update package-lock.json and rebuild dependencies'
  },
  stats: {
    total: 15000,
    additions: 7500,
    deletions: 7500
  },
  files: [
    {
      sha: 'packagelock123',
      filename: 'package-lock.json',
      status: 'modified',
      additions: 7500,
      deletions: 7500,
      changes: 15000,
      blob_url: 'https://github.com/testuser/test-repo/blob/large123def456ghi789/package-lock.json',
      raw_url: 'https://github.com/testuser/test-repo/raw/large123def456ghi789/package-lock.json',
      contents_url: 'https://api.github.com/repos/testuser/test-repo/contents/package-lock.json?ref=large123def456ghi789',
      patch: 'Too large to display (15000 lines changed)'
    }
  ]
};

// Comparison/diff response fixture
export const comparisonFixture = {
  url: 'https://api.github.com/repos/testuser/test-repo/compare/parent123abc456...abc123def456ghi789',
  html_url: 'https://github.com/testuser/test-repo/compare/parent123abc456...abc123def456ghi789',
  permalink_url: 'https://github.com/testuser/test-repo/compare/testuser:parent123...testuser:abc123d',
  diff_url: 'https://github.com/testuser/test-repo/compare/parent123abc456...abc123def456ghi789.diff',
  patch_url: 'https://github.com/testuser/test-repo/compare/parent123abc456...abc123def456ghi789.patch',
  base_commit: {
    sha: 'parent123abc456',
    node_id: 'MDY6Q29tbWl0MTIzNDU2Nzg5OnBhcmVudDEyM2FiYzQ1Ng==',
    url: 'https://api.github.com/repos/testuser/test-repo/commits/parent123abc456',
    html_url: 'https://github.com/testuser/test-repo/commit/parent123abc456',
    commit: {
      author: {
        name: 'Previous Author',
        email: 'previous@example.com',
        date: '2025-06-25T10:00:00Z'
      },
      committer: {
        name: 'Previous Author',
        email: 'previous@example.com',
        date: '2025-06-25T10:00:00Z'
      },
      message: 'Previous commit message'
    }
  },
  merge_base_commit: {
    sha: 'merge123base456',
    node_id: 'MDY6Q29tbWl0MTIzNDU2Nzg5Om1lcmdlMTIzYmFzZTQ1Ng==',
    url: 'https://api.github.com/repos/testuser/test-repo/commits/merge123base456',
    html_url: 'https://github.com/testuser/test-repo/commit/merge123base456'
  },
  status: 'ahead',
  ahead_by: 1,
  behind_by: 0,
  total_commits: 1,
  commits: [commitFixture],
  files: commitFixture.files
};

// Rate limit response fixture
export const rateLimitFixture = {
  resources: {
    core: {
      limit: 5000,
      used: 1,
      remaining: 4999,
      reset: 1640995200
    },
    search: {
      limit: 30,
      used: 0,
      remaining: 30,
      reset: 1640991600
    },
    graphql: {
      limit: 5000,
      used: 0,
      remaining: 5000,
      reset: 1640995200
    }
  },
  rate: {
    limit: 5000,
    used: 1,
    remaining: 4999,
    reset: 1640995200
  }
};

// Raw diff content fixture (unified diff format)
export const rawDiffFixture = `diff --git a/src/auth/jwt.ts b/src/auth/jwt.ts
new file mode 100644
index 0000000..abc123d
--- /dev/null
+++ b/src/auth/jwt.ts
@@ -0,0 +1,8 @@
+import jwt from 'jsonwebtoken';
+
+export function generateToken(payload: any): string {
+  return jwt.sign(payload, process.env.JWT_SECRET!);
+}
+
+export function verifyToken(token: string): any {
+  return jwt.verify(token, process.env.JWT_SECRET!);
+}
diff --git a/src/middleware/auth.ts b/src/middleware/auth.ts
new file mode 100644
index 0000000..def456g
--- /dev/null
+++ b/src/middleware/auth.ts
@@ -0,0 +1,4 @@
+import { verifyToken } from '../auth/jwt';
+
+export function authMiddleware(req: any, res: any, next: any) {
+  // Auth middleware implementation
+}
diff --git a/package.json b/package.json
index ghi789a..jkl012b 100644
--- a/package.json
+++ b/package.json
@@ -10,9 +10,6 @@
   "dependencies": {
     "express": "^4.18.0",
-    "old-auth-lib": "^1.0.0",
-    "deprecated-middleware": "^0.5.0",
-    "unused-package": "^2.1.0"
+    "jsonwebtoken": "^9.0.0"
   }
 }`;

// Empty diff fixture
export const emptyDiffFixture = '';

// Large diff fixture (for testing size limits)
export const largeDiffFixture = Array(1000).fill(0).map((_, i) => 
  `+Line ${i + 1} of a very large diff that should trigger size limits`
).join('\n');

// Error response fixtures
export const notFoundErrorFixture = {
  message: 'Not Found',
  documentation_url: 'https://docs.github.com/rest/reference/repos#get-a-repository'
};

export const unauthorizedErrorFixture = {
  message: 'Bad credentials',
  documentation_url: 'https://docs.github.com/rest'
};

export const forbiddenErrorFixture = {
  message: 'API rate limit exceeded for user ID 123456789.',
  documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting'
};

export const rateLimitedErrorFixture = {
  message: 'API rate limit exceeded for user ID 123456789.',
  documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting',
  headers: {
    'x-ratelimit-limit': '5000',
    'x-ratelimit-remaining': '0',
    'x-ratelimit-reset': '1640995200',
    'x-ratelimit-used': '5000',
    'retry-after': '3600'
  }
};

export const unprocessableEntityErrorFixture = {
  message: 'Validation Failed',
  errors: [
    {
      resource: 'Commit',
      field: 'sha',
      code: 'invalid'
    }
  ],
  documentation_url: 'https://docs.github.com/rest/reference/repos#get-a-commit'
};

// Network error simulation
export const networkErrorFixture = new Error('ECONNRESET');

// Commit range fixtures for testing getCommitsByRange
export const commitRangeFixture = [
  {
    sha: 'commit1sha123',
    commit: {
      author: { name: 'Dev One', email: 'dev1@example.com', date: '2025-06-26T09:00:00Z' },
      committer: { name: 'Dev One', email: 'dev1@example.com', date: '2025-06-26T09:00:00Z' },
      message: 'fix: resolve login issue'
    },
    author: commitFixture.author,
    committer: commitFixture.committer
  },
  {
    sha: 'commit2sha456',
    commit: {
      author: { name: 'Dev Two', email: 'dev2@example.com', date: '2025-06-26T09:30:00Z' },
      committer: { name: 'Dev Two', email: 'dev2@example.com', date: '2025-06-26T09:30:00Z' },
      message: 'feat: add new dashboard component'
    },
    author: commitFixture.author,
    committer: commitFixture.committer
  },
  {
    sha: 'commit3sha789',
    commit: {
      author: { name: 'Dev Three', email: 'dev3@example.com', date: '2025-06-26T10:00:00Z' },
      committer: { name: 'Dev Three', email: 'dev3@example.com', date: '2025-06-26T10:00:00Z' },
      message: 'refactor: improve error handling'
    },
    author: commitFixture.author,
    committer: commitFixture.committer
  }
];

// Binary file commit fixture
export const binaryFileCommitFixture = {
  ...commitFixture,
  sha: 'binary123def456',
  commit: {
    ...commitFixture.commit,
    message: 'docs: add project logo'
  },
  files: [
    {
      sha: 'binary123abc',
      filename: 'assets/logo.png',
      status: 'added',
      additions: 0,
      deletions: 0,
      changes: 0,
      blob_url: 'https://github.com/testuser/test-repo/blob/binary123def456/assets/logo.png',
      raw_url: 'https://github.com/testuser/test-repo/raw/binary123def456/assets/logo.png',
      contents_url: 'https://api.github.com/repos/testuser/test-repo/contents/assets/logo.png?ref=binary123def456',
      patch: undefined // Binary files don't have patches
    }
  ]
};

// Generated file commit fixture  
export const generatedFileCommitFixture = {
  ...commitFixture,
  sha: 'generated123def456',
  commit: {
    ...commitFixture.commit,
    message: 'build: update generated API types'
  },
  files: [
    {
      sha: 'generated123abc',
      filename: 'src/types/generated-api.ts',
      status: 'modified',
      additions: 150,
      deletions: 50,
      changes: 200,
      blob_url: 'https://github.com/testuser/test-repo/blob/generated123def456/src/types/generated-api.ts',
      raw_url: 'https://github.com/testuser/test-repo/raw/generated123def456/src/types/generated-api.ts',
      contents_url: 'https://api.github.com/repos/testuser/test-repo/contents/src/types/generated-api.ts?ref=generated123def456',
      patch: '@@ -1,3 +1,3 @@\n-// Auto-generated by openapi-typescript v1.0.0\n+// Auto-generated by openapi-typescript v1.0.1\n // DO NOT EDIT THIS FILE MANUALLY'
    }
  ]
};

// Mock factory functions for creating custom fixtures
export function createMockCommit(overrides: Partial<typeof commitFixture> = {}) {
  return {
    ...commitFixture,
    ...overrides
  };
}

export function createMockRepository(overrides: Partial<typeof repositoryFixture> = {}) {
  return {
    ...repositoryFixture,
    ...overrides
  };
}

export function createMockComparison(overrides: Partial<typeof comparisonFixture> = {}) {
  return {
    ...comparisonFixture,
    ...overrides
  };
}

// HTTP response wrapper fixtures for testing fetch responses
export function createMockResponse<T>(data: T, status: number = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : 'Error',
    headers: new Headers(headers),
    json: async () => data,
    text: async () => typeof data === 'string' ? data : JSON.stringify(data),
    url: 'https://api.github.com/mock-url'
  } as Response;
}

// GitHub API endpoint URL templates
export const githubApiUrls = {
  repository: (owner: string, repo: string) => `https://api.github.com/repos/${owner}/${repo}`,
  commit: (owner: string, repo: string, sha: string) => `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
  compare: (owner: string, repo: string, base: string, head: string) => `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`,
  rateLimit: () => 'https://api.github.com/rate_limit',
  commitDiff: (owner: string, repo: string, sha: string) => `https://github.com/${owner}/${repo}/commit/${sha}.diff`
};

/**
 * Collection of all fixtures organized by type for easy access in tests
 */
export const githubApiFixtures = {
  repositories: {
    public: repositoryFixture,
    private: privateRepositoryFixture
  },
  commits: {
    standard: commitFixture,
    large: largeCommitFixture,
    binary: binaryFileCommitFixture,
    generated: generatedFileCommitFixture,
    range: commitRangeFixture
  },
  comparisons: {
    standard: comparisonFixture
  },
  diffs: {
    standard: rawDiffFixture,
    empty: emptyDiffFixture,
    large: largeDiffFixture
  },
  errors: {
    notFound: notFoundErrorFixture,
    unauthorized: unauthorizedErrorFixture,
    forbidden: forbiddenErrorFixture,
    rateLimited: rateLimitedErrorFixture,
    unprocessableEntity: unprocessableEntityErrorFixture,
    network: networkErrorFixture
  },
  rateLimit: rateLimitFixture,
  factories: {
    createMockCommit,
    createMockRepository,
    createMockComparison,
    createMockResponse
  },
  urls: githubApiUrls
}; 