/**
 * OpenAI Rate Limiter - Token Bucket Implementation
 * Manages both requests per minute and tokens per minute limits
 * Supports different operation types with separate quotas
 */

/**
 * Rate limiting configuration for different operation types
 */
export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
  burstMultiplier?: number; // Allow bursts up to this multiple of the base rate
}

/**
 * Rate limiting operation types with different quotas
 */
export type OperationType = 'summarization' | 'change_detection' | 'general';

/**
 * Rate limiting attempt result
 */
export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  remainingRequests: number;
  remainingTokens: number;
  resetTimeMs: number;
}

/**
 * Token bucket for tracking rate limits
 */
interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number; // tokens per millisecond
}

/**
 * Rate limiter state for an operation type
 */
interface RateLimiterState {
  requestBucket: TokenBucket;
  tokenBucket: TokenBucket;
}

/**
 * Default rate limiting configurations for different operation types
 * Based on OpenAI's typical rate limits with conservative defaults
 */
const DEFAULT_CONFIGS: Record<OperationType, RateLimitConfig> = {
  summarization: {
    requestsPerMinute: 100, // Conservative for diff summarization
    tokensPerMinute: 50000, // Higher token usage for summaries
    burstMultiplier: 1.5,
  },
  change_detection: {
    requestsPerMinute: 200, // Higher for quick classification
    tokensPerMinute: 20000, // Lower tokens for simple classification
    burstMultiplier: 2.0,
  },
  general: {
    requestsPerMinute: 150, // Balanced default
    tokensPerMinute: 30000, // Balanced token allocation
    burstMultiplier: 1.5,
  },
};

/**
 * Token bucket rate limiter for OpenAI API calls
 * Implements separate limits for requests and tokens with burst capacity
 */
export class OpenAIRateLimiter {
  private states: Map<OperationType, RateLimiterState> = new Map();
  private configs: Map<OperationType, RateLimitConfig> = new Map();

  constructor(customConfigs?: Partial<Record<OperationType, Partial<RateLimitConfig>>>) {
    // Initialize with default configs
    Object.entries(DEFAULT_CONFIGS).forEach(([type, config]) => {
      this.configs.set(type as OperationType, config);
    });

    // Apply custom configurations
    if (customConfigs) {
      Object.entries(customConfigs).forEach(([type, config]) => {
        if (config) {
          this.configs.set(type as OperationType, { ...DEFAULT_CONFIGS[type as OperationType], ...config });
        }
      });
    }

    // Initialize rate limiter states
    this.configs.forEach((config, type) => {
      this.states.set(type, this.createRateLimiterState(config));
    });
  }

  /**
   * Check if a request is allowed and consume tokens if successful
   */
  async checkRateLimit(
    operationType: OperationType,
    estimatedTokens: number = 100
  ): Promise<RateLimitResult> {
    const state = this.states.get(operationType);
    const config = this.configs.get(operationType);

    if (!state || !config) {
      throw new Error(`Unknown operation type: ${operationType}`);
    }

    const now = Date.now();
    
    // Refill both buckets based on time elapsed
    this.refillBucket(state.requestBucket, now);
    this.refillBucket(state.tokenBucket, now);

    // Check if we have enough requests and tokens
    const hasRequestCapacity = state.requestBucket.tokens >= 1;
    const hasTokenCapacity = state.tokenBucket.tokens >= estimatedTokens;

    if (hasRequestCapacity && hasTokenCapacity) {
      // Consume tokens
      state.requestBucket.tokens -= 1;
      state.tokenBucket.tokens -= estimatedTokens;

      return {
        allowed: true,
        remainingRequests: Math.floor(state.requestBucket.tokens),
        remainingTokens: Math.floor(state.tokenBucket.tokens),
        resetTimeMs: this.getNextResetTime(state, now),
      };
    }

    // Calculate retry delay based on which limit was hit
    const requestRetryMs = hasRequestCapacity ? 0 : this.calculateRetryDelay(state.requestBucket, 1, now);
    const tokenRetryMs = hasTokenCapacity ? 0 : this.calculateRetryDelay(state.tokenBucket, estimatedTokens, now);
    const retryAfterMs = Math.max(requestRetryMs, tokenRetryMs);

    return {
      allowed: false,
      retryAfterMs,
      remainingRequests: Math.floor(state.requestBucket.tokens),
      remainingTokens: Math.floor(state.tokenBucket.tokens),
      resetTimeMs: this.getNextResetTime(state, now),
    };
  }

  /**
   * Get current rate limit status without consuming tokens
   */
  getStatus(operationType: OperationType): Omit<RateLimitResult, 'allowed'> {
    const state = this.states.get(operationType);
    
    if (!state) {
      throw new Error(`Unknown operation type: ${operationType}`);
    }

    const now = Date.now();
    this.refillBucket(state.requestBucket, now);
    this.refillBucket(state.tokenBucket, now);

    return {
      remainingRequests: Math.floor(state.requestBucket.tokens),
      remainingTokens: Math.floor(state.tokenBucket.tokens),
      resetTimeMs: this.getNextResetTime(state, now),
    };
  }

  /**
   * Reset rate limits (useful for testing or admin override)
   */
  reset(operationType?: OperationType): void {
    if (operationType) {
      const config = this.configs.get(operationType);
      if (config) {
        this.states.set(operationType, this.createRateLimiterState(config));
      }
    } else {
      this.configs.forEach((config, type) => {
        this.states.set(type, this.createRateLimiterState(config));
      });
    }
  }

  /**
   * Update configuration for an operation type
   */
  updateConfig(operationType: OperationType, config: Partial<RateLimitConfig>): void {
    const currentConfig = this.configs.get(operationType) || DEFAULT_CONFIGS[operationType];
    const newConfig = { ...currentConfig, ...config };
    
    this.configs.set(operationType, newConfig);
    this.states.set(operationType, this.createRateLimiterState(newConfig));
  }

  /**
   * Create rate limiter state for a configuration
   */
  private createRateLimiterState(config: RateLimitConfig): RateLimiterState {
    const now = Date.now();
    const burstMultiplier = config.burstMultiplier || 1.0;
    
    return {
      requestBucket: {
        tokens: config.requestsPerMinute * burstMultiplier,
        lastRefill: now,
        capacity: config.requestsPerMinute * burstMultiplier,
        refillRate: config.requestsPerMinute / (60 * 1000), // requests per millisecond
      },
      tokenBucket: {
        tokens: config.tokensPerMinute * burstMultiplier,
        lastRefill: now,
        capacity: config.tokensPerMinute * burstMultiplier,
        refillRate: config.tokensPerMinute / (60 * 1000), // tokens per millisecond
      },
    };
  }

  /**
   * Refill a token bucket based on elapsed time
   */
  private refillBucket(bucket: TokenBucket, now: number): void {
    const timeSinceLastRefill = now - bucket.lastRefill;
    const tokensToAdd = timeSinceLastRefill * bucket.refillRate;
    
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Calculate how long to wait before retrying
   */
  private calculateRetryDelay(bucket: TokenBucket, tokensNeeded: number, now: number): number {
    const tokensShortfall = tokensNeeded - bucket.tokens;
    if (tokensShortfall <= 0) return 0;
    
    return Math.ceil(tokensShortfall / bucket.refillRate);
  }

  /**
   * Get the next time when limits will reset
   */
  private getNextResetTime(state: RateLimiterState, now: number): number {
    const requestResetTime = state.requestBucket.lastRefill + (60 * 1000);
    const tokenResetTime = state.tokenBucket.lastRefill + (60 * 1000);
    
    return Math.max(requestResetTime, tokenResetTime);
  }
}

/**
 * Default rate limiter instance for the application
 */
export const defaultRateLimiter = new OpenAIRateLimiter();

/**
 * Factory function to create rate limiter with environment-based configuration
 */
export function createRateLimiter(overrides?: Partial<Record<OperationType, Partial<RateLimitConfig>>>): OpenAIRateLimiter {
  // Load configuration from environment variables if available
  const envConfigs: Partial<Record<OperationType, Partial<RateLimitConfig>>> = {};
  
  // Check for environment variable overrides
  const requestsPerMinute = parseInt(process.env.OPENAI_REQUESTS_PER_MINUTE || '0');
  const tokensPerMinute = parseInt(process.env.OPENAI_TOKENS_PER_MINUTE || '0');
  
  if (requestsPerMinute > 0 || tokensPerMinute > 0) {
    const baseConfig: Partial<RateLimitConfig> = {};
    if (requestsPerMinute > 0) baseConfig.requestsPerMinute = requestsPerMinute;
    if (tokensPerMinute > 0) baseConfig.tokensPerMinute = tokensPerMinute;
    
    // Apply to all operation types if environment variables are set
    envConfigs.summarization = baseConfig;
    envConfigs.change_detection = baseConfig;
    envConfigs.general = baseConfig;
  }
  
  // Merge environment configs with overrides
  const finalConfigs: Partial<Record<OperationType, Partial<RateLimitConfig>>> = { ...envConfigs, ...overrides };
  
  return new OpenAIRateLimiter(finalConfigs);
}

/**
 * Utility function to wait for rate limit reset
 */
export async function waitForRateLimit(retryAfterMs: number): Promise<void> {
  if (retryAfterMs > 0) {
    await new Promise(resolve => setTimeout(resolve, retryAfterMs));
  }
}

/**
 * Decorator function to automatically handle rate limiting for OpenAI calls
 */
export function withRateLimit(operationType: OperationType, rateLimiter: OpenAIRateLimiter = defaultRateLimiter) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;

    descriptor.value = async function (this: any, ...args: any[]) {
      // Estimate tokens based on method type (simple heuristic)
      const estimatedTokens = operationType === 'summarization' ? 500 : 50;
      
      const result = await rateLimiter.checkRateLimit(operationType, estimatedTokens);
      
      if (!result.allowed) {
        if (result.retryAfterMs) {
          await waitForRateLimit(result.retryAfterMs);
          // Retry once after waiting
          const retryResult = await rateLimiter.checkRateLimit(operationType, estimatedTokens);
          if (!retryResult.allowed) {
            throw new Error(`Rate limit exceeded for ${operationType}. Retry after ${retryResult.retryAfterMs}ms`);
          }
        } else {
          throw new Error(`Rate limit exceeded for ${operationType}`);
        }
      }
      
      return method.apply(this, args);
    } as T;

    return descriptor;
  };
} 