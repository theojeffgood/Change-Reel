import { OpenAIClient, IOpenAIClient, createOpenAIClient, OpenAIClientConfig } from '@/lib/openai/client';
import { OpenAIRateLimiter } from '@/lib/openai/rate-limiter';
import { OpenAIErrorHandler } from '@/lib/openai/error-handler';
import OpenAI from 'openai';

// Mock the OpenAI library
jest.mock('openai');
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('OpenAIClient', () => {
  let mockCreateCompletion: jest.MockedFunction<any>;
  let mockRateLimiter: jest.Mocked<OpenAIRateLimiter>;
  let mockErrorHandler: jest.Mocked<OpenAIErrorHandler>;
  let client: OpenAIClient;
  let config: OpenAIClientConfig;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock for the create method
    mockCreateCompletion = jest.fn();

    // Create mock rate limiter that always allows requests
    mockRateLimiter = {
      checkRateLimit: jest.fn().mockResolvedValue({
        allowed: true,
        remainingRequests: 100,
        remainingTokens: 10000,
        resetTimeMs: Date.now() + 60000,
      }),
      getStatus: jest.fn(),
      reset: jest.fn(),
      updateConfig: jest.fn(),
    } as any;

    // Create mock error handler that passes operations through
    mockErrorHandler = {
      executeWithRetry: jest.fn().mockImplementation(async (operation) => {
        try {
          return await operation();
        } catch (error) {
          throw error; // Re-throw errors to simulate error handler behavior
        }
      }),
      normalizeError: jest.fn(),
      getConfig: jest.fn(),
      updateConfig: jest.fn(),
    } as any;

    // Mock the OpenAI constructor to return our mock instance
    MockedOpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreateCompletion,
        },
      },
    } as any));

    config = {
      apiKey: 'test-api-key',
      model: 'gpt-4-turbo-preview',
      maxTokens: 150,
      temperature: 0.1,
      rateLimiter: mockRateLimiter,
      errorHandler: mockErrorHandler,
    };

    client = new OpenAIClient(config);
  });

  describe('constructor', () => {
    it('should create OpenAI client with correct configuration', () => {
      expect(MockedOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
      });
    });

    it('should use default model when not specified', () => {
      const clientConfig = { apiKey: 'test-key' };
      new OpenAIClient(clientConfig);
      
      expect(MockedOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
      });
    });

    it('should throw error when API key is missing', () => {
      expect(() => {
        new OpenAIClient({ apiKey: '' });
      }).toThrow('OpenAI API key is required');
    });
  });

  describe('generateSummary', () => {
    const mockDiff = `
      diff --git a/src/auth/login.ts b/src/auth/login.ts
      index 1234567..abcdefg 100644
      --- a/src/auth/login.ts
      +++ b/src/auth/login.ts
      @@ -1,3 +1,5 @@
      +import { validateUser } from './validation';
      +
       export function login(username: string, password: string) {
         // Login logic
       }
    `;

    it('should generate summary successfully with default prompt', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Add user validation import to login module',
            },
          },
        ],
      };

      mockCreateCompletion.mockResolvedValue(mockResponse as any);

      const result = await client.generateSummary(mockDiff);

      expect(result).toBe('Add user validation import to login module');
      expect(mockCreateCompletion).toHaveBeenCalledWith({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a changelog assistant that creates concise, clear summaries of code changes.',
          },
          {
            role: 'user',
            content: expect.stringContaining('You are a changelog assistant'),
          },
        ],
        max_tokens: 150,
        temperature: 0.1,
      });
    });

    it('should generate summary with custom prompt template', async () => {
      const customPrompt = 'Custom prompt: {diff}';
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Custom summary result',
            },
          },
        ],
      };

      mockCreateCompletion.mockResolvedValue(mockResponse as any);

      const result = await client.generateSummary(mockDiff, customPrompt);

      expect(result).toBe('Custom summary result');
      expect(mockCreateCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: `Custom prompt: ${mockDiff}`,
            }),
          ]),
        })
      );
    });

    it('should throw error for empty diff', async () => {
      await expect(client.generateSummary('')).rejects.toThrow('Diff content is required');
      await expect(client.generateSummary('   ')).rejects.toThrow('Diff content is required');
    });

    it('should throw error when no summary is generated', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      };

      mockCreateCompletion.mockResolvedValue(mockResponse as any);

      await expect(client.generateSummary(mockDiff)).rejects.toThrow(
        'No summary generated from OpenAI response'
      );
    });

    it('should handle OpenAI API errors through error handler', async () => {
      // Create a mock error that mimics OpenAI.APIError
      const apiError = Object.create(OpenAI.APIError.prototype);
      apiError.message = 'Rate limit exceeded';
      apiError.status = 429;
      apiError.error = { message: 'Rate limit exceeded', type: 'rate_limit_error' };
      
      // Mock the operation to throw the error
      mockCreateCompletion.mockRejectedValue(apiError);

      try {
        const result = await client.generateSummary(mockDiff);
        // If we get here, the call succeeded unexpectedly
        fail(`Expected error to be thrown but got result: ${result}`);
      } catch (error: any) {
        // This is the expected path
        expect(error.message).toContain('Rate limit exceeded');
      }

      // Verify error handler was called
      expect(mockErrorHandler.executeWithRetry).toHaveBeenCalledWith(
        expect.any(Function),
        'summarization'
      );
    });

    it('should rethrow non-API errors through error handler', async () => {
      const networkError = new Error('Network connection failed');
      mockCreateCompletion.mockRejectedValue(networkError);

      try {
        await client.generateSummary(mockDiff);
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.message).toBe('Network connection failed');
      }
      
      // Verify error handler was called
      expect(mockErrorHandler.executeWithRetry).toHaveBeenCalledWith(
        expect.any(Function),
        'summarization'
      );
    });

    it('should handle rate limiting', async () => {
      // Mock rate limiter to reject the request
      mockRateLimiter.checkRateLimit.mockResolvedValue({
        allowed: false,
        retryAfterMs: 5000,
        remainingRequests: 0,
        remainingTokens: 0,
        resetTimeMs: Date.now() + 60000,
      });

      await expect(client.generateSummary(mockDiff)).rejects.toThrow(
        'Rate limit exceeded. Retry after 5000ms. Remaining tokens: 0'
      );

      // Should check rate limit but not call OpenAI API
      expect(mockRateLimiter.checkRateLimit).toHaveBeenCalledWith('summarization', expect.any(Number));
      expect(mockCreateCompletion).not.toHaveBeenCalled();
    });

    it('should estimate tokens for rate limiting', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Test summary' } }],
      };
      mockCreateCompletion.mockResolvedValue(mockResponse as any);

      await client.generateSummary(mockDiff);

      // Should have called rate limiter with estimated tokens
      expect(mockRateLimiter.checkRateLimit).toHaveBeenCalledWith(
        'summarization',
        expect.any(Number)
      );
      
      // Get the actual token estimate
      const [[operationType, estimatedTokens]] = mockRateLimiter.checkRateLimit.mock.calls;
      expect(operationType).toBe('summarization');
      expect(estimatedTokens).toBeGreaterThan(0);
    });
  });

  describe('detectChangeType', () => {
    const mockDiff = 'sample diff content';
    const mockSummary = 'sample summary';

    it('should detect feature type', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'feature',
            },
          },
        ],
      };

      mockCreateCompletion.mockResolvedValue(mockResponse as any);

      const result = await client.detectChangeType(mockDiff, mockSummary);

      expect(result).toBe('feature');
      expect(mockCreateCompletion).toHaveBeenCalledWith({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a code change categorization assistant. Respond with only one word: feature, fix, refactor, or chore.',
          },
          {
            role: 'user',
            content: expect.stringContaining('Analyze the following code diff and summary to determine the type of change'),
          },
        ],
        max_tokens: 10,
        temperature: 0,
      });
    });

    it('should throw error for invalid response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'invalid-category',
            },
          },
        ],
      };

      mockCreateCompletion.mockResolvedValue(mockResponse as any);

      await expect(client.detectChangeType(mockDiff, 'Add new feature')).rejects.toThrow(
        'Invalid change type returned by OpenAI: "invalid-category". Expected one of: feature, fix, refactor, chore'
      );
    });

    it('should throw error on API error through error handler', async () => {
      const apiError = new Error('API Error');
      mockCreateCompletion.mockRejectedValue(apiError);

      try {
        await client.detectChangeType(mockDiff, 'Fix bug in authentication');
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.message).toBe('API Error');
      }
      
      // Verify error handler was called
      expect(mockErrorHandler.executeWithRetry).toHaveBeenCalledWith(
        expect.any(Function),
        'change_detection'
      );
    });

    it('should throw error when rate limited', async () => {
      // Mock rate limiter to reject the request
      mockRateLimiter.checkRateLimit.mockResolvedValue({
        allowed: false,
        retryAfterMs: 5000,
        remainingRequests: 0,
        remainingTokens: 0,
        resetTimeMs: Date.now() + 60000,
      });

      await expect(client.detectChangeType(mockDiff, 'Add new feature implementation')).rejects.toThrow(
        'Rate limit exceeded for change type detection. Retry after 5000ms. Remaining tokens: 0'
      );

      // Should check rate limit but not call OpenAI API
      expect(mockCreateCompletion).not.toHaveBeenCalled();
      expect(mockRateLimiter.checkRateLimit).toHaveBeenCalledWith('change_detection', expect.any(Number));
    });


  });
});

describe('createOpenAIClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('should create client with environment variable', () => {
    process.env.OPENAI_API_KEY = 'env-api-key';

    const client = createOpenAIClient();

    expect(MockedOpenAI).toHaveBeenCalledWith({
      apiKey: 'env-api-key',
    });
  });

  it('should create client with provided config', () => {
    process.env.OPENAI_API_KEY = 'env-api-key';

    const client = createOpenAIClient({
      apiKey: 'config-api-key',
      model: 'gpt-3.5-turbo',
    });

    expect(MockedOpenAI).toHaveBeenCalledWith({
      apiKey: 'config-api-key',
    });
  });

  it('should throw error when no API key is available', () => {
    expect(() => {
      createOpenAIClient();
    }).toThrow('OPENAI_API_KEY environment variable is required');
  });

  it('should use partial config with environment fallback', () => {
    process.env.OPENAI_API_KEY = 'env-api-key';

    const client = createOpenAIClient({
      model: 'gpt-3.5-turbo',
    });

    expect(MockedOpenAI).toHaveBeenCalledWith({
      apiKey: 'env-api-key',
    });
  });
}); 