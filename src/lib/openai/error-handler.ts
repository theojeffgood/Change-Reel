import OpenAI, { APIError } from 'openai';

/**
 * Custom error types for OpenAI operations
 */
export class OpenAIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export class RateLimitError extends OpenAIError {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
    public readonly remainingTokens?: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', true, 429);
    this.name = 'RateLimitError';
  }
}

export class TokenLimitError extends OpenAIError {
  constructor(message: string) {
    super(message, 'TOKEN_LIMIT_EXCEEDED', false, 400);
    this.name = 'TokenLimitError';
  }
}

export class QuotaExceededError extends OpenAIError {
  constructor(message: string) {
    super(message, 'QUOTA_EXCEEDED', false, 429);
    this.name = 'QuotaExceededError';
  }
}

export class InvalidRequestError extends OpenAIError {
  constructor(message: string) {
    super(message, 'INVALID_REQUEST', false, 400);
    this.name = 'InvalidRequestError';
  }
}

export class AuthenticationError extends OpenAIError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', false, 401);
    this.name = 'AuthenticationError';
  }
}

export class ServiceUnavailableError extends OpenAIError {
  constructor(message: string) {
    super(message, 'SERVICE_UNAVAILABLE', true, 503);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Configuration for retry strategy
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs: number;
  retryableErrorCodes: string[];
}

/**
 * Result of a retry attempt
 */
export interface RetryAttempt {
  attemptNumber: number;
  delayMs: number;
  error?: Error;
  success: boolean;
}

/**
 * Context for retry operations
 */
export interface RetryContext {
  operationType: 'summarization' | 'change_detection';
  startTime: number;
  attempts: RetryAttempt[];
  totalDelayMs: number;
}

/**
 * Error handler with configurable retry strategy and exponential backoff
 */
export class OpenAIErrorHandler {
  private config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterMs: 100,
      retryableErrorCodes: [
        'RATE_LIMIT_EXCEEDED',
        'SERVICE_UNAVAILABLE',
        'NETWORK_ERROR',
        'TIMEOUT_ERROR'
      ],
      ...config
    };
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationType: 'summarization' | 'change_detection' = 'summarization'
  ): Promise<T> {
    const context: RetryContext = {
      operationType,
      startTime: Date.now(),
      attempts: [],
      totalDelayMs: 0
    };

    let lastError: Error;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      const attemptStart = Date.now();
      
      try {
        const result = await operation();
        
        // Record successful attempt
        context.attempts.push({
          attemptNumber: attempt + 1,
          delayMs: 0,
          success: true
        });

        return result;
      } catch (error) {
        lastError = error as Error;
        const openaiError = this.normalizeError(error as Error);
        
        // Record failed attempt
        const delayMs = attempt < this.config.maxRetries 
          ? this.calculateDelay(attempt, openaiError)
          : 0;
        
        context.attempts.push({
          attemptNumber: attempt + 1,
          delayMs,
          error: openaiError,
          success: false
        });

        // Don't retry if this is the last attempt or error is not retryable
        if (attempt >= this.config.maxRetries || !this.isRetryable(openaiError)) {
          throw this.createFinalError(openaiError, context);
        }

        // Wait before retry with exponential backoff and jitter
        if (delayMs > 0) {
          context.totalDelayMs += delayMs;
          await this.delay(delayMs);
        }
      }
    }

    throw this.createFinalError(this.normalizeError(lastError!), context);
  }

  /**
   * Normalize any error into our custom error types
   */
  normalizeError(error: Error): OpenAIError {
    if (error instanceof OpenAIError) {
      return error;
    }

    if (error instanceof APIError) {
      return this.mapOpenAIError(error);
    }

    // Network or other errors
    if (error.message.toLowerCase().includes('network') || 
        error.message.toLowerCase().includes('fetch')) {
      return new ServiceUnavailableError(`Network error: ${error.message}`);
    }

    if (error.message.toLowerCase().includes('timeout')) {
      return new ServiceUnavailableError(`Request timeout: ${error.message}`);
    }

    // Unknown error
    return new OpenAIError(
      `Unexpected error: ${error.message}`,
      'UNKNOWN_ERROR',
      false
    );
  }

  /**
   * Map OpenAI API errors to our custom error types
   */
  private mapOpenAIError(error: APIError): OpenAIError {
    const status = error.status || 500;
    const message = error.message || 'Unknown OpenAI API error';

    switch (status) {
      case 400:
        if (message.toLowerCase().includes('token')) {
          return new TokenLimitError(`Token limit exceeded: ${message}`);
        }
        return new InvalidRequestError(`Invalid request: ${message}`);
      
      case 401:
        return new AuthenticationError(`Authentication failed: ${message}`);
      
      case 429:
        if (message.toLowerCase().includes('quota')) {
          return new QuotaExceededError(`API quota exceeded: ${message}`);
        }
        // Extract retry-after info if available
        const retryAfterMs = this.extractRetryAfter(error) || 60000; // Default 1 minute
        return new RateLimitError(`Rate limit exceeded: ${message}`, retryAfterMs);
      
      case 500:
      case 502:
      case 503:
      case 504:
        return new ServiceUnavailableError(`OpenAI service unavailable: ${message}`);
      
      default:
        return new OpenAIError(
          `OpenAI API error (${status}): ${message}`,
          'API_ERROR',
          status >= 500 && status < 600 // Server errors are retryable
        );
    }
  }

  /**
   * Extract retry-after information from error headers
   */
  private extractRetryAfter(error: APIError): number | null {
    try {
      // Try to extract from error response headers if available
      const headers = (error as any).headers;
      if (headers && headers['retry-after']) {
        const retryAfter = parseInt(headers['retry-after'], 10);
        return !isNaN(retryAfter) ? retryAfter * 1000 : null; // Convert seconds to ms
      }
    } catch {
      // Ignore header parsing errors
    }
    return null;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryable(error: OpenAIError): boolean {
    return error.retryable || this.config.retryableErrorCodes.includes(error.code);
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attemptNumber: number, error: OpenAIError): number {
    let delay: number;

    // Use specific delay for rate limit errors
    if (error instanceof RateLimitError) {
      delay = Math.min(error.retryAfterMs, this.config.maxDelayMs);
    } else {
      // Exponential backoff: baseDelay * (multiplier ^ attempt)
      delay = Math.min(
        this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attemptNumber),
        this.config.maxDelayMs
      );
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.config.jitterMs;
    return Math.floor(delay + jitter);
  }

  /**
   * Create final error with retry context
   */
  private createFinalError(error: OpenAIError, context: RetryContext): OpenAIError {
    const totalTime = Date.now() - context.startTime;
    const attempts = context.attempts.length;
    
    const enhancedMessage = `${error.message} (Failed after ${attempts} attempts in ${totalTime}ms, total retry delay: ${context.totalDelayMs}ms)`;
    
    const finalError = new OpenAIError(
      enhancedMessage,
      error.code,
      false, // Final error is never retryable
      error.statusCode
    );

    // Attach retry context for debugging
    (finalError as any).retryContext = context;
    
    return finalError;
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current retry configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Update retry configuration
   */
  updateConfig(newConfig: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Default error handler instance
 */
export const defaultErrorHandler = new OpenAIErrorHandler();

/**
 * Factory function for creating error handler with custom config
 */
export function createErrorHandler(config?: Partial<RetryConfig>): OpenAIErrorHandler {
  return new OpenAIErrorHandler(config);
}

/**
 * Utility function to wait for rate limit with exponential backoff
 */
export async function waitForRateLimit(retryAfterMs: number, maxWaitMs: number = 30000): Promise<void> {
  const waitTime = Math.min(retryAfterMs, maxWaitMs);
  await new Promise(resolve => setTimeout(resolve, waitTime));
}

/**
 * Check if error indicates OpenAI service issues
 */
export function isOpenAIServiceError(error: Error): boolean {
  if (error instanceof ServiceUnavailableError) {
    return true;
  }
  
  if (error instanceof APIError) {
    return (error.status || 500) >= 500 && (error.status || 500) < 600;
  }
  
  return false;
}

/**
 * Check if error is related to rate limiting
 */
export function isRateLimitError(error: Error): boolean {
  return error instanceof RateLimitError;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof OpenAIError) {
    return error.retryable;
  }
  
  if (error instanceof APIError) {
    return (error.status || 500) >= 500 && (error.status || 500) < 600;
  }
  
  return false;
} 