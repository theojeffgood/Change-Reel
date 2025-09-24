/**
 * OpenAI API Test Fixtures
 * 
 * Realistic OpenAI API responses for testing our OpenAI integration services.
 * Based on OpenAI's Responses API documentation and real API responses.
 * 
 * These fixtures support:
 * - Different types of diff summarization scenarios
 * - Error scenarios and edge cases
 * - Rate limiting responses
 * - Various response formats (success, partial, empty)
 */

import { APIError } from 'openai';
import { OpenAIClientConfig } from '@/lib/openai/client';
import { DiffProcessingConfig, SummaryResult } from '@/lib/openai/summarization-service';
import { RateLimitConfig } from '@/lib/openai/rate-limiter';
import { RetryConfig } from '@/lib/openai/error-handler';
import { DIFF_SUMMARY_TEMPLATE } from '@/lib/openai/prompts';
import OpenAI from 'openai';

// =============================================================================
// SUCCESSFUL RESPONSES
// =============================================================================

/**
 * Standard successful Responses API payload for diff summarization
 */
export const successfulSummaryResponse = {
  id: 'resp-ABC123',
  object: 'response',
  created: 1699896916,
  model: 'gpt-4.1-mini',
  status: 'completed',
  output: [
    {
      id: 'output-1',
      role: 'assistant',
      content: [
        {
          type: 'json_schema',
          json_schema: {
            name: 'DiffSummary',
            schema: {
              type: 'object',
              properties: {
                summary: { type: 'string' },
                change_type: { type: 'string' }
              },
              required: ['summary', 'change_type'],
              additionalProperties: false,
            },
            output: {
              summary: 'Add user authentication with JWT token validation and secure middleware',
              change_type: 'feature',
            },
          },
        },
      ],
      finish_reason: 'stop',
    },
  ],
  output_text: '{"summary":"Add user authentication with JWT token validation and secure middleware","change_type":"feature"}',
  usage: {
    input_tokens: 145,
    output_tokens: 12,
    total_tokens: 157,
  },
};

/**
 * Response for a bug fix summarization
 */
export const bugFixSummaryResponse = {
  id: 'resp-GHI789',
  object: 'response',
  created: 1699896918,
  model: 'gpt-4.1-mini',
  status: 'completed',
  output: [
    {
      id: 'output-1',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Fix null pointer exception in user profile validation' }],
      finish_reason: 'stop',
    },
  ],
  output_text: 'Fix null pointer exception in user profile validation',
  usage: {
    input_tokens: 98,
    output_tokens: 9,
    total_tokens: 107,
  },
};

/**
 * Response for fix change type
 */
export const fixChangeTypeResponse = {
  id: 'resp-PQR678',
  object: 'response',
  created: 1699896921,
  model: 'gpt-4.1-mini',
  status: 'completed',
  output: [
    {
      id: 'output-1',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'fix' }],
      finish_reason: 'stop',
    },
  ],
  output_text: 'fix',
  usage: {
    input_tokens: 67,
    output_tokens: 1,
    total_tokens: 68,
  },
};

// =============================================================================
// COMPLEX SCENARIO RESPONSES
// =============================================================================

/**
 * Response for a complex feature addition with multiple files
 */
export const complexFeatureSummaryResponse = {
  id: 'resp-STU901',
  object: 'response',
  created: 1699896922,
  model: 'gpt-4.1-mini',
  status: 'completed',
  output: [
    {
      id: 'output-1',
      role: 'assistant',
      content: [{
        type: 'output_text',
        text: 'Implement comprehensive user dashboard with analytics, user management, and real-time data visualization including charts and export functionality',
      }],
      finish_reason: 'stop',
    },
  ],
  output_text: 'Implement comprehensive user dashboard with analytics, user management, and real-time data visualization including charts and export functionality',
  usage: {
    input_tokens: 287,
    output_tokens: 23,
    total_tokens: 310,
  },
};

/**
 * Response for database migration summarization
 */
export const databaseMigrationSummaryResponse = {
  id: 'resp-VWX234',
  object: 'response',
  created: 1699896923,
  model: 'gpt-4.1-mini',
  status: 'completed',
  output: [
    {
      id: 'output-1',
      role: 'assistant',
      content: [{
        type: 'output_text',
        text: 'Add database migration to create user_preferences table with indexes and foreign key constraints',
      }],
      finish_reason: 'stop',
    },
  ],
  output_text: 'Add database migration to create user_preferences table with indexes and foreign key constraints',
  usage: {
    input_tokens: 156,
    output_tokens: 16,
    total_tokens: 172,
  },
};

/**
 * Response for configuration update
 */
export const configUpdateSummaryResponse = {
  id: 'resp-YZA567',
  object: 'response',
  created: 1699896924,
  model: 'gpt-4.1-mini',
  status: 'completed',
  output: [
    {
      id: 'output-1',
      role: 'assistant',
      content: [{
        type: 'output_text',
        text: 'Update environment configuration for production deployment with new API endpoints and security settings',
      }],
      finish_reason: 'stop',
    },
  ],
  output_text: 'Update environment configuration for production deployment with new API endpoints and security settings',
  usage: {
    input_tokens: 134,
    output_tokens: 17,
    total_tokens: 151,
  },
};

// =============================================================================
// EDGE CASE RESPONSES
// =============================================================================

/**
 * Response with null content (should trigger error)
 */
export const nullContentResponse = {
  id: 'resp-BCD890',
  object: 'response',
  created: 1699896925,
  model: 'gpt-4.1-mini',
  status: 'completed',
  output: [
    {
      id: 'output-1',
      role: 'assistant',
      content: [{ type: 'output_text', text: null }],
      finish_reason: 'stop',
    },
  ],
  output_text: '',
  usage: {
    input_tokens: 45,
    output_tokens: 0,
    total_tokens: 45,
  },
};

/**
 * Response with empty content (should trigger error)
 */
export const emptyContentResponse = {
  id: 'resp-EFG123',
  object: 'response',
  created: 1699896926,
  model: 'gpt-4.1-mini',
  status: 'completed',
  output: [
    {
      id: 'output-1',
      role: 'assistant',
      content: [{ type: 'output_text', text: '' }],
      finish_reason: 'stop',
    },
  ],
  output_text: '',
  usage: {
    input_tokens: 45,
    output_tokens: 0,
    total_tokens: 45,
  },
};

/**
 * Response with whitespace-only content (should be trimmed)
 */
export const whitespaceContentResponse = {
  id: 'resp-HIJ456',
  object: 'response',
  created: 1699896927,
  model: 'gpt-4.1-mini',
  status: 'completed',
  output: [
    {
      id: 'output-1',
      role: 'assistant',
      content: [{ type: 'output_text', text: '   \n\t   ' }],
      finish_reason: 'stop',
    },
  ],
  output_text: '   \n\t   ',
  usage: {
    input_tokens: 45,
    output_tokens: 1,
    total_tokens: 46,
  },
};

/**
 * Response with extra whitespace that should be trimmed
 */
export const extraWhitespaceSummaryResponse = {
  id: 'resp-KLM789',
  object: 'response',
  created: 1699896928,
  model: 'gpt-4.1-mini',
  status: 'completed',
  output: [
    {
      id: 'output-1',
      role: 'assistant',
      content: [{ type: 'output_text', text: '  Add comprehensive logging to authentication service  \n\t' }],
      finish_reason: 'stop',
    },
  ],
  output_text: '  Add comprehensive logging to authentication service  \n\t',
  usage: {
    input_tokens: 67,
    output_tokens: 8,
    total_tokens: 75,
  },
};

/**
 * Response with unusual but valid change type
 */
export const unusualChangeTypeResponse = {
  id: 'resp-NOP012',
  object: 'response',
  created: 1699896929,
  model: 'gpt-4.1-mini',
  status: 'completed',
  output: [
    {
      id: 'output-1',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'FEATURE' }], // Should be normalized to lowercase
      finish_reason: 'stop',
    },
  ],
  output_text: 'FEATURE',
  usage: {
    input_tokens: 78,
    output_tokens: 1,
    total_tokens: 79,
  },
};

// =============================================================================
// ERROR RESPONSES
// =============================================================================

/**
 * Rate limit error response
 */
export const rateLimitErrorResponse = {
  error: {
    message: 'Rate limit reached for requests',
    type: 'requests',
    param: null,
    code: 'rate_limit_exceeded',
  },
};

/**
 * Token limit error response  
 */
export const tokenLimitErrorResponse = {
  error: {
    message: 'This model\'s maximum context length is 4097 tokens. However, you requested 5000 tokens.',
    type: 'invalid_request_error',
    param: null,
    code: 'context_length_exceeded',
  },
};

/**
 * Authentication error response
 */
export const authenticationErrorResponse = {
  error: {
    message: 'Incorrect API key provided',
    type: 'invalid_request_error',
    param: null,
    code: 'invalid_api_key',
  },
};

/**
 * Quota exceeded error response
 */
export const quotaExceededErrorResponse = {
  error: {
    message: 'You exceeded your current quota, please check your plan and billing details',
    type: 'insufficient_quota',
    param: null,
    code: 'insufficient_quota',
  },
};

/**
 * Service unavailable error response
 */
export const serviceUnavailableErrorResponse = {
  error: {
    message: 'The server is overloaded or not ready yet',
    type: 'server_error',
    param: null,
    code: 'server_error',
  },
};

/**
 * Invalid request error response
 */
export const invalidRequestErrorResponse = {
  error: {
    message: 'Invalid value for \'model\': gpt-invalid-model',
    type: 'invalid_request_error',
    param: 'model',
    code: 'invalid_model',
  },
};

// =============================================================================
// STREAMING RESPONSES (for future use)
// =============================================================================

/**
 * Sample streaming response events
 */
export const streamingResponseChunks = [
  {
    type: 'response.output_text.delta',
    response_id: 'resp-streaming123',
    output_index: 0,
    delta: 'Add',
  },
  {
    type: 'response.output_text.delta',
    response_id: 'resp-streaming123',
    output_index: 0,
    delta: ' user',
  },
  {
    type: 'response.output_text.delta',
    response_id: 'resp-streaming123',
    output_index: 0,
    delta: ' authentication',
  },
  {
    type: 'response.completed',
    response: {
      id: 'resp-streaming123',
      object: 'response',
      model: 'gpt-4.1-mini',
      status: 'completed',
      output: [
        {
          id: 'output-1',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Add user authentication' }],
          finish_reason: 'stop',
        },
      ],
      output_text: 'Add user authentication',
      usage: {
        input_tokens: 120,
        output_tokens: 15,
        total_tokens: 135,
      },
    },
  },
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a mock OpenAI APIError instance
 */
export function createMockAPIError(
  message: string,
  status: number,
  errorType: string = 'api_error',
  code?: string
): APIError {
  const error = Object.create(APIError.prototype);
  error.message = message;
  error.status = status;
  error.error = {
    message,
    type: errorType,
    code: code || errorType,
    param: null,
  };
  return error;
}

/**
 * Create a custom Responses API payload
 */
export function createMockChatCompletion(overrides: {
  content?: string | null;
  id?: string;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  finish_reason?: string;
} = {}) {
  const textContent = overrides.content !== undefined ? overrides.content : 'Mock response content';
  return {
    id: overrides.id || 'resp-custom123',
    object: 'response',
    created: Math.floor(Date.now() / 1000),
    model: overrides.model || 'gpt-4.1-mini',
    status: 'completed',
    output: [
      {
        id: 'output-1',
        role: 'assistant',
        content: [{ type: 'output_text', text: textContent }],
        finish_reason: overrides.finish_reason || 'stop',
      },
    ],
    output_text: typeof textContent === 'string' ? textContent : '',
    usage: {
      input_tokens: overrides.usage?.input_tokens || 50,
      output_tokens: overrides.usage?.output_tokens || 10,
      total_tokens: overrides.usage?.total_tokens || 60,
    },
  };
}

/**
 * Create rate limit exceeded APIError
 */
export function createRateLimitError(retryAfterMs: number = 30000): APIError {
  const error = createMockAPIError(
    `Rate limit exceeded. Retry after ${retryAfterMs}ms`,
    429,
    'rate_limit_error',
    'rate_limit_exceeded'
  );
  // Add retry-after header simulation
  (error as any).headers = { 'retry-after': Math.ceil(retryAfterMs / 1000).toString() };
  return error;
}

/**
 * Create authentication error
 */
export function createAuthenticationError(): APIError {
  return createMockAPIError(
    'Incorrect API key provided',
    401,
    'invalid_request_error',
    'invalid_api_key'
  );
}

/**
 * Create token limit exceeded error
 */
export function createTokenLimitError(): APIError {
  return createMockAPIError(
    'This model\'s maximum context length is 4097 tokens. However, you requested 5000 tokens.',
    400,
    'invalid_request_error',
    'context_length_exceeded'
  );
}

/**
 * Create quota exceeded error
 */
export function createQuotaExceededError(): APIError {
  return createMockAPIError(
    'You exceeded your current quota, please check your plan and billing details',
    429,
    'insufficient_quota',
    'insufficient_quota'
  );
}

/**
 * Create service unavailable error
 */
export function createServiceUnavailableError(): APIError {
  return createMockAPIError(
    'The server is overloaded or not ready yet',
    503,
    'server_error',
    'server_error'
  );
}

/**
 * Create invalid request error
 */
export function createInvalidRequestError(message: string = 'Invalid request'): APIError {
  return createMockAPIError(
    message,
    400,
    'invalid_request_error',
    'invalid_request'
  );
}

// =============================================================================
// SCENARIO-BASED FIXTURES
// =============================================================================

/**
 * Common diff scenarios and their expected responses
 */
export const diffScenarios = {
  newFeature: {
    diff: `diff --git a/src/auth/login.ts b/src/auth/login.ts
index 1234567..abcdefg 100644
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -1,3 +1,8 @@
+import { validateUser } from './validation';
+import { generateToken } from './jwt';
+
 export function login(username: string, password: string) {
-  // Login logic
+  const user = validateUser(username, password);
+  if (user) {
+    return generateToken(user);
+  }
 }`,
    expectedSummary: 'Add user authentication with JWT token validation and secure middleware',
    expectedChangeType: 'feature',
    response: successfulSummaryResponse,
  },

  bugFix: {
    diff: `diff --git a/src/utils/validation.ts b/src/utils/validation.ts
index abc1234..def5678 100644
--- a/src/utils/validation.ts
+++ b/src/utils/validation.ts
@@ -5,7 +5,7 @@ export function validateEmail(email: string): boolean {
 }

 export function validateUser(user: User): boolean {
-  return user && user.email && validateEmail(user.email);
+  return user && user.email && user.id && validateEmail(user.email);
 }`,
    expectedSummary: 'Fix null pointer exception in user profile validation',
    expectedChangeType: 'fix',
    response: bugFixSummaryResponse,
  },

};

/**
 * Error scenario fixtures
 */
export const errorScenarios = {
  rateLimitExceeded: {
    error: createRateLimitError(30000),
    expectedBehavior: 'Should throw RateLimitError with retry timing',
  },

  authenticationFailed: {
    error: createAuthenticationError(),
    expectedBehavior: 'Should throw AuthenticationError',
  },

  tokenLimitExceeded: {
    error: createTokenLimitError(),
    expectedBehavior: 'Should throw TokenLimitError',
  },

  quotaExceeded: {
    error: createQuotaExceededError(),
    expectedBehavior: 'Should throw QuotaExceededError',
  },

  serviceUnavailable: {
    error: createServiceUnavailableError(),
    expectedBehavior: 'Should throw ServiceUnavailableError',
  },

  invalidRequest: {
    error: createInvalidRequestError('Invalid model specified'),
    expectedBehavior: 'Should throw InvalidRequestError',
  },

  networkError: {
    error: new Error('Network connection failed'),
    expectedBehavior: 'Should propagate network error through error handler',
  },
};

// =============================================================================
// EXPORTS FOR EASY TESTING
// =============================================================================

/**
 * All successful responses for quick access
 */
export const successfulResponses = {
  summary: successfulSummaryResponse,
  bugFix: bugFixSummaryResponse,
  fix: fixChangeTypeResponse,
  complex: complexFeatureSummaryResponse,
  database: databaseMigrationSummaryResponse,
  config: configUpdateSummaryResponse,
};

/**
 * All edge case responses for testing error handling
 */
export const edgeCaseResponses = {
  nullContent: nullContentResponse,
  emptyContent: emptyContentResponse,
  whitespaceContent: whitespaceContentResponse,
  extraWhitespace: extraWhitespaceSummaryResponse,
  unusualChangeType: unusualChangeTypeResponse,
};

/**
 * All error responses for testing error scenarios
 */
export const errorResponses = {
  rateLimit: rateLimitErrorResponse,
  tokenLimit: tokenLimitErrorResponse,
  authentication: authenticationErrorResponse,
  quotaExceeded: quotaExceededErrorResponse,
  serviceUnavailable: serviceUnavailableErrorResponse,
  invalidRequest: invalidRequestErrorResponse,
};

/**
 * Default export with organized structure
 */
export default {
  successful: successfulResponses,
  edgeCases: edgeCaseResponses,
  errors: errorResponses,
  scenarios: diffScenarios,
  errorScenarios,
  utilities: {
    createMockChatCompletion,
    createMockAPIError,
    createRateLimitError,
    createAuthenticationError,
    createTokenLimitError,
    createQuotaExceededError,
    createServiceUnavailableError,
    createInvalidRequestError,
  },
  streaming: streamingResponseChunks,
};

// =============================================================================
// SAMPLE GIT DIFFS
// =============================================================================

export const SAMPLE_DIFFS = {
  // Simple feature addition
  SIMPLE_FEATURE: `diff --git a/src/auth/login.ts b/src/auth/login.ts
index 1234567..abcdefg 100644
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -1,3 +1,5 @@
+import { validateUser } from './validation';
+
 export function login(username: string, password: string) {
   // Login logic
 }`,

  // Bug fix
  BUG_FIX: `diff --git a/src/utils/format.ts b/src/utils/format.ts
index 7890123..fedcba9 100644
--- a/src/utils/format.ts
+++ b/src/utils/format.ts
@@ -5,7 +5,7 @@ export function formatDate(date: Date): string {
   if (!date || !(date instanceof Date)) {
-    return 'Invalid date';
+    return '';
   }
   
   return date.toISOString().split('T')[0];
 }`,

  // Refactoring changes
  REFACTOR: `diff --git a/src/services/database.ts b/src/services/database.ts
index abc1234..def5678 100644
--- a/src/services/database.ts
+++ b/src/services/database.ts
@@ -10,15 +10,8 @@ class DatabaseService {
   
-  async getUserById(id: string): Promise<User | null> {
-    const query = 'SELECT * FROM users WHERE id = ?';
-    const result = await this.db.query(query, [id]);
-    return result.rows[0] || null;
-  }
-  
-  async getUserByEmail(email: string): Promise<User | null> {
-    const query = 'SELECT * FROM users WHERE email = ?';
-    const result = await this.db.query(query, [email]);
-    return result.rows[0] || null;
+  async findUser(criteria: { id?: string; email?: string }): Promise<User | null> {
+    const { id, email } = criteria;
+    const query = id ? 'SELECT * FROM users WHERE id = ?' : 'SELECT * FROM users WHERE email = ?';
+    const param = id || email;
+    const result = await this.db.query(query, [param]);
+    return result.rows[0] || null;
   }
 }`,

  // Multiple files changed
  MULTI_FILE: `diff --git a/src/components/Header.tsx b/src/components/Header.tsx
index 1111111..2222222 100644
--- a/src/components/Header.tsx
+++ b/src/components/Header.tsx
@@ -1,5 +1,6 @@
 import React from 'react';
+import { Logo } from './Logo';
 
 export function Header() {
-  return <header>App Name</header>;
+  return <header><Logo /> App Name</header>;
 }
diff --git a/src/components/Logo.tsx b/src/components/Logo.tsx
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/components/Logo.tsx
@@ -0,0 +1,7 @@
+import React from 'react';
+
+export function Logo() {
+  return (
+    <img src="/logo.svg" alt="Logo" className="h-8 w-8" />
+  );
+}`,

  // With noise files (should be filtered)
  WITH_NOISE: `diff --git a/package-lock.json b/package-lock.json
index 5555555..6666666 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1000,6 +1000,12 @@
     "node_modules/some-package": {
+      "version": "1.2.3",
+      "resolved": "https://registry.npmjs.org/some-package/-/some-package-1.2.3.tgz",
+      "integrity": "sha512-...",
+      "dev": true
     }
+  }
diff --git a/src/feature.ts b/src/feature.ts
index 7777777..8888888 100644
--- a/src/feature.ts
+++ b/src/feature.ts
@@ -1,3 +1,4 @@
 export function newFeature() {
+  console.log('Feature implemented');
   return true;
 }`,

  // Very large diff (for truncation testing)
  LARGE_DIFF: `diff --git a/src/large-file.ts b/src/large-file.ts
index 9999999..aaaaaaa 100644
--- a/src/large-file.ts
+++ b/src/large-file.ts
@@ -1,10 +1,1000 @@
${''.padStart(5000, 'x')}`,

  // Empty/minimal diffs
  EMPTY: '',
  WHITESPACE_ONLY: '   \n   \t   \n   ',
  MINIMAL_VALID: '@@ -1,1 +1,2 @@\n+new line',
  
  // Invalid diffs
  INVALID_NO_MARKERS: 'just some random text without diff markers',
  INVALID_FORMAT: 'diff but no proper structure here',
};

// =============================================================================
// OPENAI API RESPONSES
// =============================================================================

export const OPENAI_RESPONSES = {
  // Successful responses
  SUCCESS: {
    FEATURE_SUMMARY: {
      output_text: 'Add user validation import to login module',
      output: [
        {
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Add user validation import to login module' }],
        },
      ],
    },
    BUG_FIX_SUMMARY: {
      output_text: 'Fix date formatting to return empty string for invalid dates',
      output: [
        {
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Fix date formatting to return empty string for invalid dates' }],
        },
      ],
    },
    REFACTOR_SUMMARY: {
      output_text: 'Refactor user lookup methods into unified findUser function',
      output: [
        {
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Refactor user lookup methods into unified findUser function' }],
        },
      ],
    },
    CHANGE_TYPE_FEATURE: {
      output_text: 'feature',
      output: [
        {
          role: 'assistant',
          content: [{ type: 'output_text', text: 'feature' }],
        },
      ],
    },
    CHANGE_TYPE_FIX: {
      output_text: 'fix',
      output: [
        {
          role: 'assistant',
          content: [{ type: 'output_text', text: 'fix' }],
        },
      ],
    },
  },

  // Error responses
  ERROR: {
    EMPTY_CONTENT: {
      output_text: '',
      output: [
        {
          role: 'assistant',
          content: [{ type: 'output_text', text: null }],
        },
      ],
    },
    NO_OUTPUT: {
      output: [],
    },
    MALFORMED: {
      // Missing output array
    },
  },
};

// =============================================================================
// ERROR SCENARIOS
// =============================================================================

export const API_ERRORS = {
  RATE_LIMIT: (() => {
    const error = Object.create(OpenAI.APIError.prototype);
    error.message = 'Rate limit exceeded';
    error.status = 429;
    error.error = { 
      message: 'Rate limit exceeded. Please retry after 60 seconds.', 
      type: 'rate_limit_error',
      code: 'rate_limit_exceeded'
    };
    return error;
  })(),

  AUTHENTICATION: (() => {
    const error = Object.create(OpenAI.APIError.prototype);
    error.message = 'Invalid authentication';
    error.status = 401;
    error.error = { 
      message: 'Invalid API key provided', 
      type: 'invalid_request_error',
      code: 'invalid_api_key'
    };
    return error;
  })(),

  INVALID_REQUEST: (() => {
    const error = Object.create(OpenAI.APIError.prototype);
    error.message = 'Invalid request';
    error.status = 400;
    error.error = { 
      message: 'Invalid request format', 
      type: 'invalid_request_error'
    };
    return error;
  })(),

  SERVER_ERROR: (() => {
    const error = Object.create(OpenAI.APIError.prototype);
    error.message = 'Internal server error';
    error.status = 500;
    error.error = { 
      message: 'The server had an error while processing your request', 
      type: 'server_error'
    };
    return error;
  })(),

  NETWORK_ERROR: new Error('Network connection failed'),
  
  TIMEOUT_ERROR: (() => {
    const error = new Error('Request timeout');
    error.name = 'TimeoutError';
    return error;
  })(),
};

// =============================================================================
// CONFIGURATION OBJECTS
// =============================================================================

export const CONFIGS = {
  // OpenAI Client configurations
  CLIENT: {
    DEFAULT: {
      apiKey: 'test-api-key',
      model: 'gpt-4-turbo-preview',
      maxTokens: 150,
    } as OpenAIClientConfig,

    CUSTOM: {
      apiKey: 'custom-test-key',
      model: 'gpt-3.5-turbo',
      maxTokens: 200,
    } as OpenAIClientConfig,

    MINIMAL: {
      apiKey: 'minimal-key',
    } as OpenAIClientConfig,
  },

  // Rate limiter configurations
  RATE_LIMITER: {
    DEFAULT: {
      requestsPerMinute: 100,
      tokensPerMinute: 50000,
      burstMultiplier: 1.5,
    } as RateLimitConfig,

    STRICT: {
      requestsPerMinute: 10,
      tokensPerMinute: 1000,
      burstMultiplier: 1.0,
    } as RateLimitConfig,

    PERMISSIVE: {
      requestsPerMinute: 1000,
      tokensPerMinute: 100000,
      burstMultiplier: 2.0,
    } as RateLimitConfig,
  },

  // Error handler configurations
  ERROR_HANDLER: {
    DEFAULT: {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterMs: 100,
      retryableErrorCodes: ['RATE_LIMIT_EXCEEDED', 'SERVICE_UNAVAILABLE', 'NETWORK_ERROR', 'TIMEOUT_ERROR'],
    } as RetryConfig,

    AGGRESSIVE: {
      maxRetries: 5,
      baseDelayMs: 500,
      maxDelayMs: 60000,
      backoffMultiplier: 2.5,
      jitterMs: 200,
      retryableErrorCodes: ['RATE_LIMIT_EXCEEDED', 'SERVICE_UNAVAILABLE', 'NETWORK_ERROR', 'TIMEOUT_ERROR'],
    } as RetryConfig,

    MINIMAL: {
      maxRetries: 1,
      baseDelayMs: 2000,
      maxDelayMs: 10000,
      backoffMultiplier: 1.5,
      jitterMs: 50,
      retryableErrorCodes: ['RATE_LIMIT_EXCEEDED', 'SERVICE_UNAVAILABLE'],
    } as RetryConfig,
  },

  // Diff processing configurations
  DIFF_PROCESSING: {
    DEFAULT: {
      maxDiffLength: 8000,
      excludePatterns: [
        'package-lock.json',
        'yarn.lock',
        '.min.js',
        '.map',
      ],
    } as DiffProcessingConfig,

    STRICT: {
      maxDiffLength: 2000,
      excludePatterns: [
        'package-lock.json',
        'yarn.lock',
        '.min.js',
        '.map',
        'node_modules/',
        '.log',
        '.tmp',
      ],
      customContext: 'Only include significant functional changes.',
    } as DiffProcessingConfig,

    VERBOSE: {
      maxDiffLength: 20000,
      excludePatterns: [
        'package-lock.json',
      ],
      customContext: 'Include all relevant changes with detailed context.',
    } as DiffProcessingConfig,
  },
};

// =============================================================================
// EXPECTED RESULTS
// =============================================================================

export const EXPECTED_RESULTS = {
  SUMMARY_RESULTS: {
    FEATURE: {
      summary: 'Add user validation import to login module',
      changeType: 'feature',
      confidence: expect.any(Number),
      metadata: {
        diffLength: expect.any(Number),
        processingTimeMs: expect.any(Number),
        templateUsed: 'diff_summary',
      },
    } as SummaryResult,

    BUG_FIX: {
      summary: 'Fix date formatting to return empty string for invalid dates',
      changeType: 'fix',
      confidence: expect.any(Number),
      metadata: {
        diffLength: expect.any(Number),
        processingTimeMs: expect.any(Number),
        templateUsed: 'diff_summary',
      },
    } as SummaryResult,
  },

  CHANGE_TYPES: {
    FEATURE: 'feature',
    FIX: 'fix',
  } as const,
};

// =============================================================================
// PROMPT TEMPLATES
// =============================================================================

export const PROMPT_TEMPLATES = {
  DIFF_SUMMARY: {
    DEFAULT: DIFF_SUMMARY_TEMPLATE,
    CUSTOM: 'Custom prompt template: {diff}',
    WITH_CONTEXT: 'Analyze this diff with special attention to: {context}\n\nDiff content:\n{diff}',
  },
};

// =============================================================================
// MOCK FACTORY FUNCTIONS
// =============================================================================

/**
 * Creates a mock OpenAI client with default successful responses
 */
export function createMockOpenAIClient(): jest.Mocked<import('@/lib/openai/client').IOpenAIClient> {
  return {
    generateSummary: jest.fn().mockResolvedValue({
      summary: 'Mock summary generated',
      changeType: 'feature',
    }),
  };
}

/**
 * Creates a mock rate limiter that allows all requests by default
 */
export function createMockRateLimiter() {
  return {
    checkRateLimit: jest.fn().mockResolvedValue({
      allowed: true,
      remainingRequests: 100,
      remainingTokens: 10000,
      resetTimeMs: Date.now() + 60000,
    }),
    getStatus: jest.fn().mockReturnValue({
      remainingRequests: 100,
      remainingTokens: 10000,
      resetTimeMs: Date.now() + 60000,
    }),
    reset: jest.fn(),
    updateConfig: jest.fn(),
  };
}

/**
 * Creates a mock error handler that passes operations through by default
 */
export function createMockErrorHandler() {
  return {
    executeWithRetry: jest.fn().mockImplementation(async (operation) => {
      return await operation();
    }),
    normalizeError: jest.fn().mockImplementation((error) => error),
    getConfig: jest.fn().mockReturnValue(CONFIGS.ERROR_HANDLER.DEFAULT),
    updateConfig: jest.fn(),
  };
}

/**
 * Creates a mock template engine with default behavior
 */
export function createMockTemplateEngine() {
  return {
    renderTemplate: jest.fn().mockImplementation((template: string, variables: Record<string, any>) => {
      // Simple variable substitution for testing
      return template.replace(/\{(\w+)\}/g, (match: string, key: string) => variables[key] || match);
    }),
    createDiffSummaryPrompt: jest.fn().mockReturnValue(PROMPT_TEMPLATES.DIFF_SUMMARY.DEFAULT),
  };
}

/**
 * Creates a realistic diff with specified characteristics
 */
export function createTestDiff(options: {
  type?: 'feature' | 'fix';
  files?: number;
  size?: 'small' | 'medium' | 'large';
  hasNoise?: boolean;
}): string {
  const { type = 'feature', files = 1, size = 'small', hasNoise = false } = options;
  
  let diff = '';
  
  if (hasNoise) {
    diff += SAMPLE_DIFFS.WITH_NOISE;
  }
  
  for (let i = 0; i < files; i++) {
    switch (type) {
      case 'feature':
        diff += i === 0 ? SAMPLE_DIFFS.SIMPLE_FEATURE : SAMPLE_DIFFS.MULTI_FILE;
        break;
      case 'fix':
        diff += SAMPLE_DIFFS.BUG_FIX;
        break;
      default:
        diff += SAMPLE_DIFFS.SIMPLE_FEATURE;
    }
  }
  
  if (size === 'large') {
    diff += '\n' + SAMPLE_DIFFS.LARGE_DIFF;
  }
  
  return diff;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Waits for a specified number of milliseconds (useful for testing rate limiting)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a timestamp for testing time-based functionality
 */
export function createTestTimestamp(offsetMs: number = 0): number {
  return Date.now() + offsetMs;
}

/**
 * Validates that a summary result has the expected structure
 */
export function validateSummaryResult(result: any): result is SummaryResult {
  return (
    typeof result === 'object' &&
    typeof result.summary === 'string' &&
    typeof result.changeType === 'string' &&
    typeof result.confidence === 'number' &&
    typeof result.metadata === 'object' &&
    typeof result.metadata.diffLength === 'number' &&
    typeof result.metadata.processingTimeMs === 'number' &&
    typeof result.metadata.templateUsed === 'string'
  );
} 
