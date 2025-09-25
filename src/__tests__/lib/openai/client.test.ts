import { OpenAIClient, IOpenAIClient, createOpenAIClient, OpenAIClientConfig } from '@/lib/openai/client';
import { OpenAIRateLimiter } from '@/lib/openai/rate-limiter';
import { OpenAIErrorHandler } from '@/lib/openai/error-handler';
import OpenAI from 'openai';

// Mock the OpenAI library
jest.mock('openai');
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('OpenAIClient', () => {
  let mockResponsesCreate: jest.MockedFunction<any>;
  let mockRateLimiter: jest.Mocked<OpenAIRateLimiter>;
  let mockErrorHandler: jest.Mocked<OpenAIErrorHandler>;
  let client: OpenAIClient;
  let config: OpenAIClientConfig;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock for the create method
    mockResponsesCreate = jest.fn();

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
      responses: {
        create: mockResponsesCreate,
      },
    } as any));

    config = {
      apiKey: 'test-api-key',
      model: 'gpt-4-turbo-preview',
      maxTokens: 150,
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
      const payload = {
        summary: 'Add user validation import to login module',
        change_type: 'feature',
      };
      const mockResponse = {
        output_text: JSON.stringify(payload),
        output: [
          {
            role: 'assistant',
            content: [{ type: 'output_text', text: JSON.stringify(payload) }],
            finish_reason: 'stop',
          },
        ],
        usage: {
          input_tokens: 120,
          output_tokens: 20,
          total_tokens: 140,
        },
      };

      mockResponsesCreate.mockResolvedValue(mockResponse as any);

      const result = await client.generateSummary(mockDiff);

      expect(result).toEqual({
        summary: 'Add user validation import to login module',
        changeType: 'feature',
      });
      expect(mockResponsesCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockResponsesCreate.mock.calls[0][0];
      expect(callArgs).toMatchObject({
        model: 'gpt-4-turbo-preview',
        max_output_tokens: 150,
      });
      expect(callArgs.instructions).toContain('You are a product changelog assistant');
      expect(typeof callArgs.input).toBe('string');
      expect(callArgs.input).toContain('Diff:');
    });

    it('should generate summary with custom context', async () => {
      const customContext = 'Custom prompt: focus on API behavior';
      const payload = { summary: 'Custom summary result', change_type: 'fix' };
      const mockResponse = {
        output_text: JSON.stringify(payload),
        output: [
          {
            role: 'assistant',
            content: [{ type: 'output_text', text: JSON.stringify(payload) }],
            finish_reason: 'stop',
          },
        ],
      };

      mockResponsesCreate.mockResolvedValue(mockResponse as any);

      const result = await client.generateSummary(mockDiff, { customContext });

      expect(result).toEqual({ summary: 'Custom summary result', changeType: 'fix' });
      const callArgs = mockResponsesCreate.mock.calls[mockResponsesCreate.mock.calls.length - 1][0];
      expect(typeof callArgs.input).toBe('string');
      expect(callArgs.input).toContain(customContext);
      expect(callArgs.input).toContain('Context:');
    });

    it('should default change type when model returns invalid value', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const payload = { summary: 'Summary for invalid change type', change_type: 'something-else' };
      const mockResponse = {
        output_text: JSON.stringify(payload),
        output: [
          {
            role: 'assistant',
            content: [{ type: 'output_text', text: JSON.stringify(payload) }],
            finish_reason: 'stop',
          },
        ],
      };

      mockResponsesCreate.mockResolvedValue(mockResponse as any);

      const result = await client.generateSummary(mockDiff);

      expect(result).toEqual({
        summary: 'Summary for invalid change type',
        changeType: 'feature',
      });
      expect(warnSpy).toHaveBeenCalledWith(
        '[OpenAIClient] Invalid or missing change type from summary response, defaulting to "feature"',
        { received: 'something-else' }
      );

      warnSpy.mockRestore();
    });

    it('should throw error for empty diff', async () => {
      await expect(client.generateSummary('')).rejects.toThrow('Diff content is required');
      await expect(client.generateSummary('   ')).rejects.toThrow('Diff content is required');
    });

    it('should throw error when no summary is generated', async () => {
      const mockResponse = {
        output_text: JSON.stringify({ change_type: 'feature' }),
        output: [
          {
            role: 'assistant',
            content: [{ type: 'output_text', text: JSON.stringify({ change_type: 'feature' }) }],
          },
        ],
        usage: { output_tokens: 0 },
      };

      mockResponsesCreate.mockResolvedValue(mockResponse as any);

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
      mockResponsesCreate.mockRejectedValue(apiError);

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
      mockResponsesCreate.mockRejectedValue(networkError);

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
      expect(mockResponsesCreate).not.toHaveBeenCalled();
    });

    it('should estimate tokens for rate limiting', async () => {
      const payload = { summary: 'Test summary', change_type: 'feature' };
      const mockResponse = {
        output_text: JSON.stringify(payload),
        output: [
          {
            content: [{ type: 'output_text', text: JSON.stringify(payload) }],
            finish_reason: 'stop',
          },
        ],
      };
      mockResponsesCreate.mockResolvedValue(mockResponse as any);

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
