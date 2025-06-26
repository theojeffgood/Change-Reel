/**
 * Tests for GitHub API caching system
 */

import {
  MemoryCache,
  CacheKeyUtils,
  createCache,
  CacheConfigs,
  type ICache,
  type CacheConfig,
} from '../../../lib/github/cache';
import type { DiffReference } from '../../../lib/github/diff-service';
import type { CommitReference } from '../../../lib/github/commit-service';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache({
      defaultTtl: 1000,
      maxEntries: 5,
      maxMemory: 1024,
      cleanupInterval: 0, // Disable automatic cleanup for testing
      enableStats: true,
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      const key = 'test-key';
      const value = { data: 'test' };

      cache.set(key, value);
      const result = cache.get(key);

      expect(result).toEqual(value);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should check if key exists', () => {
      const key = 'test-key';
      
      expect(cache.has(key)).toBe(false);
      
      cache.set(key, 'value');
      expect(cache.has(key)).toBe(true);
    });

    it('should delete entries', () => {
      const key = 'test-key';
      cache.set(key, 'value');
      
      expect(cache.has(key)).toBe(true);
      expect(cache.delete(key)).toBe(true);
      expect(cache.has(key)).toBe(false);
      expect(cache.delete(key)).toBe(false); // Already deleted
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.getStats().entries).toBe(2);
      
      cache.clear();
      
      expect(cache.getStats().entries).toBe(0);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('TTL functionality', () => {
    it('should expire entries after TTL', async () => {
      const key = 'test-key';
      const value = 'test-value';
      
      cache.set(key, value, 50); // 50ms TTL
      
      expect(cache.get(key)).toBe(value);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));
      
      expect(cache.get(key)).toBeNull();
      expect(cache.has(key)).toBe(false);
    });

    it('should use default TTL when none specified', () => {
      const key = 'test-key';
      const value = 'test-value';
      
      cache.set(key, value);
      
      const stats = cache.getStats();
      expect(stats.entries).toBe(1);
    });

    it('should update existing entries', () => {
      const key = 'test-key';
      
      cache.set(key, 'value1');
      cache.set(key, 'value2');
      
      expect(cache.get(key)).toBe('value2');
      expect(cache.getStats().entries).toBe(1);
    });
  });

  describe('capacity management', () => {
    it('should respect max entries limit', () => {
      // Fill cache to capacity
      for (let i = 0; i < 10; i++) {
        cache.set(`key-${i}`, `value-${i}`);
      }
      
      const stats = cache.getStats();
      expect(stats.entries).toBeLessThanOrEqual(5); // Max entries is 5
    });

    it('should evict oldest entries when memory limit reached', () => {
      // Create large values to exceed memory limit
      const largeValue = 'x'.repeat(500);
      
      cache.set('key1', largeValue);
      cache.set('key2', largeValue);
      cache.set('key3', largeValue); // This should trigger eviction
      
      // At least one entry should be evicted due to memory constraints
      const stats = cache.getStats();
      expect(stats.entries).toBeLessThan(3);
      expect(stats.evictions).toBeGreaterThan(0);
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      const key = 'test-key';
      
      // Miss
      cache.get(key);
      let stats = cache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
      
      // Hit
      cache.set(key, 'value');
      cache.get(key);
      stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should calculate hit rate correctly', () => {
      const key = 'test-key';
      
      // Test basic hit rate calculation
      cache.get('non-existent'); // miss
      cache.set(key, 'value');
      cache.get(key); // hit
      
      const stats = cache.getStats();
      const totalRequests = stats.hits + stats.misses;
      expect(totalRequests).toBeGreaterThan(0);
      expect(stats.hitRate).toBe((stats.hits / totalRequests) * 100);
    });

    it('should track memory usage', () => {
      const key = 'test-key';
      const value = 'test-value';
      
      cache.set(key, value);
      
      const stats = cache.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.entries).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should manually cleanup expired entries', async () => {
      cache.set('key1', 'value1', 50);
      cache.set('key2', 'value2', 1000);
      
      expect(cache.getStats().entries).toBe(2);
      
      // Wait for first entry to expire
      await new Promise(resolve => setTimeout(resolve, 60));
      
      const cleaned = cache.cleanup();
      expect(cleaned).toBe(1);
      expect(cache.getStats().entries).toBe(1);
      expect(cache.has('key2')).toBe(true);
    });
  });
});

describe('CacheKeyUtils', () => {
  const diffRef: DiffReference = {
    owner: 'test-owner',
    repo: 'test-repo',
    base: 'main',
    head: 'feature-branch',
  };

  const commitRef: CommitReference = {
    owner: 'test-owner',
    repo: 'test-repo',
    sha: 'abc123',
  };

  describe('diff keys', () => {
    it('should generate diff key without options', () => {
      const key = CacheKeyUtils.diffKey(diffRef);
      expect(key).toBe('diff:test-owner:test-repo:main:feature-branch');
    });

    it('should generate diff key with options', () => {
      const key = CacheKeyUtils.diffKey(diffRef, { maxFiles: 10, includePatches: false });
      expect(key).toBe('diff:test-owner:test-repo:main:feature-branch:maxFiles:10:noPatches');
    });

    it('should generate raw diff key', () => {
      const key = CacheKeyUtils.diffRawKey(diffRef);
      expect(key).toBe('diff-raw:test-owner:test-repo:main:feature-branch');
    });

    it('should generate diff stats key', () => {
      const key = CacheKeyUtils.diffStatsKey(diffRef);
      expect(key).toBe('diff-stats:test-owner:test-repo:main:feature-branch');
    });
  });

  describe('commit keys', () => {
    it('should generate commit key', () => {
      const key = CacheKeyUtils.commitKey(commitRef);
      expect(key).toBe('commit:test-owner:test-repo:abc123');
    });

    it('should generate commit range key', () => {
      const key = CacheKeyUtils.commitRangeKey(diffRef);
      expect(key).toBe('commits:test-owner:test-repo:main:feature-branch');
    });
  });

  describe('other keys', () => {
    it('should generate repository key', () => {
      const key = CacheKeyUtils.repositoryKey('owner', 'repo');
      expect(key).toBe('repo:owner:repo');
    });

    it('should generate rate limit key', () => {
      const key = CacheKeyUtils.rateLimitKey();
      expect(key).toBe('rate-limit:github');
    });

    it('should generate validation keys', () => {
      const commitKey = CacheKeyUtils.validationKey('commit', commitRef);
      expect(commitKey).toBe('validate:commit:test-owner:test-repo:abc123');

      const diffKey = CacheKeyUtils.validationKey('diff', diffRef);
      expect(diffKey).toBe('validate:diff:test-owner:test-repo:main:feature-branch');
    });
  });
});

describe('cache factory and configs', () => {
  it('should create cache with factory function', () => {
    const cache = createCache({ defaultTtl: 5000 });
    expect(cache).toBeDefined();
    
    cache.set('test', 'value');
    expect(cache.get('test')).toBe('value');
  });

  it('should have predefined cache configurations', () => {
    expect(CacheConfigs.SHORT_LIVED.defaultTtl).toBe(30 * 1000);
    expect(CacheConfigs.MEDIUM_LIVED.defaultTtl).toBe(5 * 60 * 1000);
    expect(CacheConfigs.LONG_LIVED.defaultTtl).toBe(30 * 60 * 1000);
    expect(CacheConfigs.DEVELOPMENT.defaultTtl).toBe(10 * 1000);
  });
});

describe('ICache interface compliance', () => {
  let cache: ICache;

  beforeEach(() => {
    cache = createCache({
      defaultTtl: 1000,
      cleanupInterval: 0,
    });
  });

  it('should implement all ICache methods', () => {
    expect(typeof cache.get).toBe('function');
    expect(typeof cache.set).toBe('function');
    expect(typeof cache.delete).toBe('function');
    expect(typeof cache.clear).toBe('function');
    expect(typeof cache.has).toBe('function');
    expect(typeof cache.getStats).toBe('function');
    expect(typeof cache.cleanup).toBe('function');
  });

  it('should work with generic types', () => {
    interface TestData {
      id: number;
      name: string;
    }

    const testData: TestData = { id: 1, name: 'test' };
    
    cache.set<TestData>('test', testData);
    const result = cache.get<TestData>('test');
    
    expect(result).toEqual(testData);
    expect(result?.id).toBe(1);
    expect(result?.name).toBe('test');
  });
}); 