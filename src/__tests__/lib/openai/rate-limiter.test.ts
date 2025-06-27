/**
 * Test suite for OpenAI Rate Limiter
 * Tests token bucket implementation, rate limiting, and configuration
 */

import {
  OpenAIRateLimiter,
  createRateLimiter,
  defaultRateLimiter,
  waitForRateLimit,
  withRateLimit,
  OperationType,
  RateLimitConfig,
  RateLimitResult,
} from '../../../lib/openai/rate-limiter';

describe('OpenAIRateLimiter', () => {
  let rateLimiter: OpenAIRateLimiter;

  beforeEach(() => {
    rateLimiter = new OpenAIRateLimiter();
  });

  describe('constructor and initialization', () => {
    it('should initialize with default configurations', () => {
      const limiter = new OpenAIRateLimiter();
      
      const summaryStatus = limiter.getStatus('summarization');
      const changeStatus = limiter.getStatus('change_detection');
      const generalStatus = limiter.getStatus('general');

      // Should have burst capacity initially (default * burstMultiplier)
      expect(summaryStatus.remainingRequests).toBe(150); // 100 * 1.5
      expect(summaryStatus.remainingTokens).toBe(75000); // 50000 * 1.5
      
      expect(changeStatus.remainingRequests).toBe(400); // 200 * 2.0
      expect(changeStatus.remainingTokens).toBe(40000); // 20000 * 2.0
      
      expect(generalStatus.remainingRequests).toBe(225); // 150 * 1.5
      expect(generalStatus.remainingTokens).toBe(45000); // 30000 * 1.5
    });

    it('should accept custom configurations', () => {
      const customConfig = {
        summarization: {
          requestsPerMinute: 50,
          tokensPerMinute: 25000,
          burstMultiplier: 1.0,
        },
      };

      const limiter = new OpenAIRateLimiter(customConfig);
      const status = limiter.getStatus('summarization');

      expect(status.remainingRequests).toBe(50);
      expect(status.remainingTokens).toBe(25000);
    });

    it('should merge custom configs with defaults', () => {
      const customConfig = {
        summarization: {
          requestsPerMinute: 75, // Override only this field
        },
      };

      const limiter = new OpenAIRateLimiter(customConfig);
      const status = limiter.getStatus('summarization');

      // Should use custom requestsPerMinute but default tokensPerMinute and burstMultiplier
      expect(status.remainingRequests).toBe(112); // 75 * 1.5 (default burst)
      expect(status.remainingTokens).toBe(75000); // 50000 * 1.5 (default values)
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      // Use a fresh limiter with low limits for easier testing
      rateLimiter = new OpenAIRateLimiter({
        summarization: {
          requestsPerMinute: 60, // 1 request per second
          tokensPerMinute: 6000, // 100 tokens per second
          burstMultiplier: 1.0,
        },
      });
    });

    it('should allow requests within limits', async () => {
      const result = await rateLimiter.checkRateLimit('summarization', 50);

      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(59);
      expect(result.remainingTokens).toBe(5950);
      expect(result.retryAfterMs).toBeUndefined();
      expect(result.resetTimeMs).toBeGreaterThan(Date.now());
    });

    it('should reject requests when request limit exceeded', async () => {
      // Exhaust request limit
      for (let i = 0; i < 60; i++) {
        await rateLimiter.checkRateLimit('summarization', 1);
      }

      const result = await rateLimiter.checkRateLimit('summarization', 1);

      expect(result.allowed).toBe(false);
      expect(result.remainingRequests).toBe(0);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('should reject requests when token limit exceeded', async () => {
      const result = await rateLimiter.checkRateLimit('summarization', 7000); // More than limit

      expect(result.allowed).toBe(false);
      expect(result.remainingTokens).toBeLessThan(7000);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('should throw error for unknown operation type', async () => {
      await expect(
        rateLimiter.checkRateLimit('unknown' as OperationType, 100)
      ).rejects.toThrow('Unknown operation type: unknown');
    });

    it('should calculate correct retry delay', async () => {
      // Exhaust tokens
      await rateLimiter.checkRateLimit('summarization', 6000);
      
      const result = await rateLimiter.checkRateLimit('summarization', 100);
      
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      // Should be roughly 1 second for 100 tokens at 100 tokens/second rate
      expect(result.retryAfterMs).toBeLessThan(2000);
    });
  });

  describe('token bucket refilling', () => {
    beforeEach(() => {
      rateLimiter = new OpenAIRateLimiter({
        summarization: {
          requestsPerMinute: 60, // 1 per second
          tokensPerMinute: 6000, // 100 per second
          burstMultiplier: 1.0,
        },
      });
    });

    it('should refill tokens over time', async () => {
      // Consume some tokens
      await rateLimiter.checkRateLimit('summarization', 1000);
      
      const statusBefore = rateLimiter.getStatus('summarization');
      expect(statusBefore.remainingTokens).toBe(5000);

      // Wait 500ms and check refill (should get ~50 tokens back)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const statusAfter = rateLimiter.getStatus('summarization');
      expect(statusAfter.remainingTokens).toBeGreaterThan(5000);
      expect(statusAfter.remainingTokens).toBeLessThan(5100); // Not exact due to timing
    });

    it('should not exceed capacity when refilling', async () => {
      // Wait for potential over-refill
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const status = rateLimiter.getStatus('summarization');
      
      // Should not exceed original capacity
      expect(status.remainingRequests).toBeLessThanOrEqual(60);
      expect(status.remainingTokens).toBeLessThanOrEqual(6000);
    });
  });

  describe('getStatus', () => {
    it('should return current status without consuming tokens', () => {
      const statusBefore = rateLimiter.getStatus('summarization');
      const statusAfter = rateLimiter.getStatus('summarization');

      expect(statusBefore.remainingRequests).toBe(statusAfter.remainingRequests);
      expect(statusBefore.remainingTokens).toBe(statusAfter.remainingTokens);
    });

    it('should throw error for unknown operation type', () => {
      expect(() => rateLimiter.getStatus('unknown' as OperationType))
        .toThrow('Unknown operation type: unknown');
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      rateLimiter = new OpenAIRateLimiter({
        summarization: {
          requestsPerMinute: 60,
          tokensPerMinute: 6000,
          burstMultiplier: 1.0,
        },
      });
    });

    it('should reset specific operation type', async () => {
      // Consume resources
      await rateLimiter.checkRateLimit('summarization', 1000);
      await rateLimiter.checkRateLimit('summarization', 1000);
      
      const statusBefore = rateLimiter.getStatus('summarization');
      expect(statusBefore.remainingRequests).toBe(58);
      expect(statusBefore.remainingTokens).toBe(4000);

      // Reset
      rateLimiter.reset('summarization');
      
      const statusAfter = rateLimiter.getStatus('summarization');
      expect(statusAfter.remainingRequests).toBe(60);
      expect(statusAfter.remainingTokens).toBe(6000);
    });

    it('should reset all operation types when no type specified', async () => {
      // Consume resources for multiple types
      await rateLimiter.checkRateLimit('summarization', 1000);
      await rateLimiter.checkRateLimit('change_detection', 500);
      
      rateLimiter.reset();
      
      const summaryStatus = rateLimiter.getStatus('summarization');
      const changeStatus = rateLimiter.getStatus('change_detection');
      
      // Should be reset to configured capacity (60 and original defaults for others)
      expect(summaryStatus.remainingRequests).toBe(60); // Using test config
      expect(changeStatus.remainingRequests).toBe(400); // Default config with burst
    });
  });

  describe('updateConfig', () => {
    it('should update configuration for operation type', () => {
      const newConfig = {
        requestsPerMinute: 200,
        tokensPerMinute: 10000,
      };

      rateLimiter.updateConfig('summarization', newConfig);
      
      const status = rateLimiter.getStatus('summarization');
      // Should reflect new config with default burst multiplier
      expect(status.remainingRequests).toBe(300); // 200 * 1.5
      expect(status.remainingTokens).toBe(15000); // 10000 * 1.5
    });

    it('should merge partial config with existing values', () => {
      // Only update requests per minute
      rateLimiter.updateConfig('summarization', {
        requestsPerMinute: 80,
      });
      
      const status = rateLimiter.getStatus('summarization');
      expect(status.remainingRequests).toBe(120); // 80 * 1.5
      expect(status.remainingTokens).toBe(75000); // Original tokens * 1.5
    });
  });

  describe('different operation types', () => {
    it('should maintain separate limits for different operation types', async () => {
      // Test that operation types are isolated
      const summaryResult = await rateLimiter.checkRateLimit('summarization', 1000);
      const changeResult = await rateLimiter.checkRateLimit('change_detection', 500);
      const generalResult = await rateLimiter.checkRateLimit('general', 300);

      expect(summaryResult.allowed).toBe(true);
      expect(changeResult.allowed).toBe(true);
      expect(generalResult.allowed).toBe(true);

      // Each should have consumed from its own bucket
      expect(summaryResult.remainingTokens).toBe(74000); // 75000 - 1000
      expect(changeResult.remainingTokens).toBe(39500); // 40000 - 500
      expect(generalResult.remainingTokens).toBe(44700); // 45000 - 300
    });
  });
});

describe('createRateLimiter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should create limiter with default config when no env vars', () => {
    const limiter = createRateLimiter();
    const status = limiter.getStatus('summarization');

    expect(status.remainingRequests).toBe(150); // Default with burst
    expect(status.remainingTokens).toBe(75000);
  });

  it('should respect environment variable overrides', () => {
    process.env.OPENAI_REQUESTS_PER_MINUTE = '120';
    process.env.OPENAI_TOKENS_PER_MINUTE = '30000';

    const limiter = createRateLimiter();
    
    // Should apply env vars to all operation types
    const summaryStatus = limiter.getStatus('summarization');
    const changeStatus = limiter.getStatus('change_detection');
    
    expect(summaryStatus.remainingRequests).toBe(180); // 120 * 1.5
    expect(summaryStatus.remainingTokens).toBe(45000); // 30000 * 1.5
    expect(changeStatus.remainingRequests).toBe(240); // 120 * 2.0
    expect(changeStatus.remainingTokens).toBe(60000); // 30000 * 2.0
  });

  it('should merge overrides with environment config', () => {
    process.env.OPENAI_REQUESTS_PER_MINUTE = '100';
    
    const overrides = {
      summarization: {
        tokensPerMinute: 40000,
      },
    };

    const limiter = createRateLimiter(overrides);
    const status = limiter.getStatus('summarization');

    // Should use env requests but override tokens
    expect(status.remainingRequests).toBe(150); // 100 * 1.5
    expect(status.remainingTokens).toBe(60000); // 40000 * 1.5
  });
});

describe('utility functions', () => {
  describe('waitForRateLimit', () => {
    it('should wait for specified duration', async () => {
      const startTime = Date.now();
      await waitForRateLimit(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(95); // Allow some timing variance
      expect(endTime - startTime).toBeLessThan(150);
    });

    it('should not wait when duration is 0', async () => {
      const startTime = Date.now();
      await waitForRateLimit(0);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10);
    });
  });

  describe('withRateLimit decorator', () => {
    let testRateLimiter: OpenAIRateLimiter;

    beforeEach(() => {
      testRateLimiter = new OpenAIRateLimiter({
        summarization: {
          requestsPerMinute: 2, // Very low for testing
          tokensPerMinute: 1000,
          burstMultiplier: 1.0,
        },
      });
    });

    it('should exist and be a function', () => {
      expect(typeof withRateLimit).toBe('function');
    });

    it('should return a decorator function', () => {
      const decorator = withRateLimit('summarization', testRateLimiter);
      expect(typeof decorator).toBe('function');
    });

    // Note: Full decorator testing would require more complex setup
    // The decorator is primarily intended for production use with proper TypeScript compilation
    it('should have correct function signature', () => {
      // Test that the decorator can be called with the expected arguments
      expect(() => withRateLimit('summarization', testRateLimiter)).not.toThrow();
      expect(() => withRateLimit('change_detection')).not.toThrow();
      expect(() => withRateLimit('general')).not.toThrow();
    });
  });
});

describe('defaultRateLimiter', () => {
  it('should be properly initialized', () => {
    expect(defaultRateLimiter).toBeInstanceOf(OpenAIRateLimiter);
    
    const status = defaultRateLimiter.getStatus('summarization');
    expect(status.remainingRequests).toBeGreaterThan(0);
    expect(status.remainingTokens).toBeGreaterThan(0);
  });
});

describe('edge cases and error handling', () => {
  let rateLimiter: OpenAIRateLimiter;

  beforeEach(() => {
    rateLimiter = new OpenAIRateLimiter({
      summarization: {
        requestsPerMinute: 60,
        tokensPerMinute: 6000,
        burstMultiplier: 1.0,
      },
    });
  });

  it('should handle zero token requests', async () => {
    const result = await rateLimiter.checkRateLimit('summarization', 0);
    
    expect(result.allowed).toBe(true);
    expect(result.remainingRequests).toBe(59);
    expect(result.remainingTokens).toBe(6000); // No tokens consumed
  });

  it('should handle very large token requests', async () => {
    const result = await rateLimiter.checkRateLimit('summarization', 10000);
    
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('should handle rapid consecutive calls', async () => {
    const promises = [];
    
    // Make 10 rapid calls that will exceed limits
    for (let i = 0; i < 10; i++) {
      promises.push(rateLimiter.checkRateLimit('summarization', 1000)); // Each uses 1000 tokens
    }

    const results = await Promise.all(promises);
    
    // Some should succeed, some should fail (6000 tokens available, so 6 should succeed max)
    const allowed = results.filter(r => r.allowed).length;
    const rejected = results.filter(r => !r.allowed).length;
    
    expect(allowed).toBeGreaterThan(0);
    expect(allowed).toBeLessThanOrEqual(6); // Max 6 requests with 1000 tokens each
    expect(rejected).toBeGreaterThan(0);
    expect(allowed + rejected).toBe(10);
  });

  it('should maintain consistency across multiple operations', async () => {
    // Perform mixed operations - check what the actual test config is
    await rateLimiter.checkRateLimit('summarization', 1000);
    await rateLimiter.checkRateLimit('change_detection', 500);
    
    const summaryStatus = rateLimiter.getStatus('summarization');
    const changeStatus = rateLimiter.getStatus('change_detection');
    
    // Each operation should maintain its own state
    // Note: this test uses custom config for summarization (6000 tokens) 
    // and default config for change_detection (40000 tokens with burst)
    expect(summaryStatus.remainingTokens).toBeLessThan(6000);
    expect(changeStatus.remainingTokens).toBeLessThan(40000);
    
    // Check actual consumption based on the test configuration
    expect(summaryStatus.remainingTokens).toBe(5000); // 6000 - 1000
    expect(changeStatus.remainingTokens).toBe(39500); // 40000 - 500
  });
}); 