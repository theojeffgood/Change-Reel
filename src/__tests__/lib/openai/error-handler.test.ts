import OpenAI, { APIError } from 'openai';
import {
  OpenAIErrorHandler,
  OpenAIError,
  RateLimitError,
  TokenLimitError,
  QuotaExceededError,
  InvalidRequestError,
  AuthenticationError,
  ServiceUnavailableError,
  defaultErrorHandler,
  createErrorHandler,
  isOpenAIServiceError,
  isRateLimitError,
  isRetryableError,
  RetryConfig
} from '../../../lib/openai/error-handler';

describe('OpenAI Error Handler', () => {
  let errorHandler: OpenAIErrorHandler;

  beforeEach(() => {
    errorHandler = new OpenAIErrorHandler({
      maxRetries: 2,
      baseDelayMs: 10, // Very small delays for testing
      maxDelayMs: 50,
      backoffMultiplier: 2,
      jitterMs: 5
    });
  });

  describe('Custom Error Classes', () => {
    it('should create OpenAIError with correct properties', () => {
      const error = new OpenAIError('Test error', 'TEST_CODE', true, 500);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.retryable).toBe(true);
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('OpenAIError');
    });

    it('should create RateLimitError with retry info', () => {
      const error = new RateLimitError('Rate limited', 5000, 100);
      expect(error.retryAfterMs).toBe(5000);
      expect(error.remainingTokens).toBe(100);
      expect(error.retryable).toBe(true);
      expect(error.statusCode).toBe(429);
    });

    it('should create non-retryable errors correctly', () => {
      const tokenError = new TokenLimitError('Token limit');
      const quotaError = new QuotaExceededError('Quota exceeded');
      const invalidError = new InvalidRequestError('Invalid request');
      const authError = new AuthenticationError('Auth failed');

      expect(tokenError.retryable).toBe(false);
      expect(quotaError.retryable).toBe(false);
      expect(invalidError.retryable).toBe(false);
      expect(authError.retryable).toBe(false);
    });

    it('should create retryable service error', () => {
      const serviceError = new ServiceUnavailableError('Service down');
      expect(serviceError.retryable).toBe(true);
      expect(serviceError.statusCode).toBe(503);
    });
  });

  describe('Error Normalization', () => {
    it('should return OpenAIError as-is', () => {
      const originalError = new RateLimitError('Rate limited', 1000);
      const normalized = errorHandler.normalizeError(originalError);
      expect(normalized).toBe(originalError);
    });

    it('should map OpenAI API errors correctly', () => {
      // Mock OpenAI API error
      const apiError = Object.create(APIError.prototype);
      apiError.status = 429;
      apiError.message = 'Rate limit exceeded';

      const normalized = errorHandler.normalizeError(apiError);
      expect(normalized).toBeInstanceOf(RateLimitError);
      expect(normalized.message).toContain('Rate limit exceeded');
    });

    it('should map 400 errors to TokenLimitError for token-related messages', () => {
      const apiError = Object.create(APIError.prototype);
      apiError.status = 400;
      apiError.message = 'Token limit exceeded for this request';

      const normalized = errorHandler.normalizeError(apiError);
      expect(normalized).toBeInstanceOf(TokenLimitError);
    });

    it('should map 400 errors to InvalidRequestError for non-token messages', () => {
      const apiError = Object.create(APIError.prototype);
      apiError.status = 400;
      apiError.message = 'Invalid model parameter';

      const normalized = errorHandler.normalizeError(apiError);
      expect(normalized).toBeInstanceOf(InvalidRequestError);
    });

    it('should map 401 errors to AuthenticationError', () => {
      const apiError = Object.create(APIError.prototype);
      apiError.status = 401;
      apiError.message = 'Invalid API key';

      const normalized = errorHandler.normalizeError(apiError);
      expect(normalized).toBeInstanceOf(AuthenticationError);
    });

    it('should map 429 quota errors to QuotaExceededError', () => {
      const apiError = Object.create(APIError.prototype);
      apiError.status = 429;
      apiError.message = 'You have exceeded your quota';

      const normalized = errorHandler.normalizeError(apiError);
      expect(normalized).toBeInstanceOf(QuotaExceededError);
    });

    it('should map 5xx errors to ServiceUnavailableError', () => {
      const statuses = [500, 502, 503, 504];
      
      statuses.forEach(status => {
        const apiError = Object.create(APIError.prototype);
        apiError.status = status;
        apiError.message = 'Server error';

        const normalized = errorHandler.normalizeError(apiError);
        expect(normalized).toBeInstanceOf(ServiceUnavailableError);
      });
    });

    it('should handle network errors', () => {
      const networkError = new Error('Network fetch failed');
      const normalized = errorHandler.normalizeError(networkError);
      
      expect(normalized).toBeInstanceOf(ServiceUnavailableError);
      expect(normalized.message).toContain('Network error');
    });

    it('should handle timeout errors', () => {
      const timeoutError = new Error('Request timeout');
      const normalized = errorHandler.normalizeError(timeoutError);
      
      expect(normalized).toBeInstanceOf(ServiceUnavailableError);
      expect(normalized.message).toContain('Request timeout');
    });

    it('should handle unknown errors', () => {
      const unknownError = new Error('Something weird happened');
      const normalized = errorHandler.normalizeError(unknownError);
      
      expect(normalized).toBeInstanceOf(OpenAIError);
      expect(normalized.code).toBe('UNKNOWN_ERROR');
      expect(normalized.retryable).toBe(false);
    });
  });

  describe('Retry Logic', () => {
    it('should succeed on first attempt', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await errorHandler.executeWithRetry(mockOperation, 'summarization');
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should not retry non-retryable errors', async () => {
      const authError = new AuthenticationError('Invalid API key');
      const mockOperation = jest.fn().mockRejectedValue(authError);

      await expect(errorHandler.executeWithRetry(mockOperation))
        .rejects.toThrow('Invalid API key');
      
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should include retry context in final error', async () => {
      const serviceError = new ServiceUnavailableError('Service down');
      const mockOperation = jest.fn().mockRejectedValue(serviceError);

      try {
        await errorHandler.executeWithRetry(mockOperation);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Failed after 3 attempts');
        expect(error.retryContext).toBeDefined();
        expect(error.retryContext.attempts).toHaveLength(3);
      }
    });
  });

  describe('Configuration', () => {
    it('should use default config', () => {
      const handler = new OpenAIErrorHandler();
      const config = handler.getConfig();
      
      expect(config.maxRetries).toBe(3);
      expect(config.baseDelayMs).toBe(1000);
      expect(config.maxDelayMs).toBe(30000);
    });

    it('should allow config updates', () => {
      const handler = new OpenAIErrorHandler();
      handler.updateConfig({ maxRetries: 5, baseDelayMs: 500 });
      
      const config = handler.getConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.baseDelayMs).toBe(500);
    });
  });

  describe('Factory Functions', () => {
    it('should create error handler with custom config', () => {
      const handler = createErrorHandler({ maxRetries: 5 });
      expect(handler.getConfig().maxRetries).toBe(5);
    });

    it('should provide default error handler', () => {
      expect(defaultErrorHandler).toBeInstanceOf(OpenAIErrorHandler);
    });
  });

  describe('Utility Functions', () => {
    it('should identify OpenAI service errors', () => {
      const serviceError = new ServiceUnavailableError('Service down');
      const apiError = Object.create(APIError.prototype);
      apiError.status = 502;
      const normalError = new Error('Normal error');

      expect(isOpenAIServiceError(serviceError)).toBe(true);
      expect(isOpenAIServiceError(apiError)).toBe(true);
      expect(isOpenAIServiceError(normalError)).toBe(false);
    });

    it('should identify rate limit errors', () => {
      const rateLimitError = new RateLimitError('Rate limited', 1000);
      const normalError = new Error('Normal error');

      expect(isRateLimitError(rateLimitError)).toBe(true);
      expect(isRateLimitError(normalError)).toBe(false);
    });

    it('should identify retryable errors', () => {
      const retryableError = new ServiceUnavailableError('Service down');
      const nonRetryableError = new AuthenticationError('Auth failed');
      const apiError = Object.create(APIError.prototype);
      apiError.status = 503;

      expect(isRetryableError(retryableError)).toBe(true);
      expect(isRetryableError(nonRetryableError)).toBe(false);
      expect(isRetryableError(apiError)).toBe(true);
    });
  });

  describe('Integration with OpenAI Client', () => {
    it('should handle OpenAI API errors in real scenarios', async () => {
      // Simulate a real OpenAI API error scenario
      const mockApiError = Object.create(APIError.prototype);
      mockApiError.status = 429;
      mockApiError.message = 'Rate limit exceeded';
      
      const mockOperation = jest.fn().mockRejectedValue(mockApiError);

      try {
        await errorHandler.executeWithRetry(mockOperation);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Rate limit exceeded');
      }
    });

    it('should handle successful operations after retries', async () => {
      const mockApiError = Object.create(APIError.prototype);
      mockApiError.status = 503;
      mockApiError.message = 'Service temporarily unavailable';
      
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(mockApiError)
        .mockResolvedValue({
          output_text: 'Success',
          output: [
            {
              role: 'assistant',
              content: [{ type: 'output_text', text: 'Success' }],
              finish_reason: 'stop',
            },
          ],
        });

      const result = await errorHandler.executeWithRetry(mockOperation) as any;
      expect(result.output_text).toBe('Success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined status in API errors', () => {
      const apiError = Object.create(APIError.prototype);
      apiError.message = 'Error without status';
      // status is undefined

      const normalized = errorHandler.normalizeError(apiError);
      expect(normalized).toBeInstanceOf(ServiceUnavailableError);
    });

    it('should handle errors without retry-after headers', () => {
      const apiError = Object.create(APIError.prototype);
      apiError.status = 429;
      apiError.message = 'Rate limit exceeded';
      // No headers property

      const normalized = errorHandler.normalizeError(apiError);
      expect(normalized).toBeInstanceOf(RateLimitError);
      expect((normalized as RateLimitError).retryAfterMs).toBe(60000); // Default
    });
  });
}); 
