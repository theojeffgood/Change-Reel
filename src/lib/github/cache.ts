/**
 * GitHub API Caching System
 * 
 * Provides efficient caching for GitHub API responses to reduce rate limit usage
 * and improve performance. Supports TTL-based invalidation and cache statistics.
 * 
 * Features:
 * - TTL (Time To Live) based cache expiration
 * - Configurable cache size limits
 * - Cache statistics and monitoring
 * - Type-safe cache key generation
 * - Automatic cleanup of expired entries
 */

import type { DiffReference, DiffData } from './diff-service';
import type { CommitReference, CommitDetails } from './commit-service';

/**
 * Cache entry with TTL and metadata
 */
export interface CacheEntry<T = any> {
  /** Cached data */
  data: T;
  /** Timestamp when the entry was created */
  createdAt: number;
  /** Timestamp when the entry expires */
  expiresAt: number;
  /** Cache key for identification */
  key: string;
  /** Size of the cached data in bytes (approximate) */
  size: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Default TTL in milliseconds (default: 5 minutes) */
  defaultTtl: number;
  /** Maximum number of cache entries (default: 1000) */
  maxEntries: number;
  /** Maximum memory usage in bytes (default: 50MB) */
  maxMemory: number;
  /** Cleanup interval in milliseconds (default: 1 minute) */
  cleanupInterval: number;
  /** Enable cache statistics collection */
  enableStats: boolean;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Current number of entries */
  entries: number;
  /** Current memory usage in bytes */
  memoryUsage: number;
  /** Hit rate percentage */
  hitRate: number;
  /** Number of expired entries cleaned up */
  evictions: number;
}

/**
 * Cache interface for dependency injection
 */
export interface ICache {
  /** Get cached value by key */
  get<T>(key: string): T | null;
  /** Set value in cache with optional TTL */
  set<T>(key: string, value: T, ttl?: number): void;
  /** Remove entry from cache */
  delete(key: string): boolean;
  /** Clear all cache entries */
  clear(): void;
  /** Check if key exists in cache */
  has(key: string): boolean;
  /** Get cache statistics */
  getStats(): CacheStats;
  /** Manually trigger cleanup of expired entries */
  cleanup(): number;
}

/**
 * In-memory cache implementation with TTL support
 */
export class MemoryCache implements ICache {
  private entries = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTtl: 5 * 60 * 1000, // 5 minutes
      maxEntries: 1000,
      maxMemory: 50 * 1024 * 1024, // 50MB
      cleanupInterval: 60 * 1000, // 1 minute
      enableStats: true,
      ...config,
    };

    this.stats = {
      hits: 0,
      misses: 0,
      entries: 0,
      memoryUsage: 0,
      hitRate: 0,
      evictions: 0,
    };

    // Start cleanup timer
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this.config.cleanupInterval);
    }
  }

  get<T>(key: string): T | null {
    const entry = this.entries.get(key);
    
    if (!entry) {
      this.updateStats({ misses: 1 });
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      this.updateStats({ misses: 1, evictions: 1 });
      this.updateMemoryUsage();
      return null;
    }

    this.updateStats({ hits: 1 });
    return entry.data as T;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl ?? this.config.defaultTtl);
    const size = this.estimateSize(value);

    // Remove existing entry if it exists
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }

    // Check if we need to make room
    this.ensureCapacity(size);

    const entry: CacheEntry<T> = {
      data: value,
      createdAt: now,
      expiresAt,
      key,
      size,
    };

    this.entries.set(key, entry);
    this.updateMemoryUsage();
  }

  delete(key: string): boolean {
    const result = this.entries.delete(key);
    if (result) {
      this.updateMemoryUsage();
    }
    return result;
  }

  clear(): void {
    this.entries.clear();
    this.stats.entries = 0;
    this.stats.memoryUsage = 0;
  }

  has(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      this.updateStats({ evictions: 1 });
      this.updateMemoryUsage();
      return false;
    }
    
    return true;
  }

  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      entries: this.entries.size,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
    };
  }

  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.entries.entries()) {
      if (now > entry.expiresAt) {
        this.entries.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.updateStats({ evictions: cleaned });
      this.updateMemoryUsage();
    }

    return cleaned;
  }

  /**
   * Destroy the cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }

  private ensureCapacity(newEntrySize: number): void {
    // Check memory limit
    while (this.stats.memoryUsage + newEntrySize > this.config.maxMemory) {
      const oldestKey = this.getOldestKey();
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
      this.updateStats({ evictions: 1 });
    }

    // Check entry count limit
    while (this.entries.size >= this.config.maxEntries) {
      const oldestKey = this.getOldestKey();
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
      this.updateStats({ evictions: 1 });
    }

    this.updateMemoryUsage();
  }

  private getOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.entries.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Default size if serialization fails
    }
  }

  private updateMemoryUsage(): void {
    this.stats.memoryUsage = Array.from(this.entries.values())
      .reduce((total, entry) => total + entry.size, 0);
    this.stats.entries = this.entries.size;
  }

  private updateStats(updates: Partial<CacheStats>): void {
    if (!this.config.enableStats) return;
    
    Object.assign(this.stats, updates);
  }
}

/**
 * Cache key generation utilities
 */
export class CacheKeyUtils {
  /**
   * Generate cache key for diff requests
   */
  static diffKey(ref: DiffReference, options?: { maxFiles?: number; includePatches?: boolean }): string {
    const base = `diff:${ref.owner}:${ref.repo}:${ref.base}:${ref.head}`;
    if (!options) return base;
    
    const opts = [];
    if (options.maxFiles !== undefined) opts.push(`maxFiles:${options.maxFiles}`);
    if (options.includePatches === false) opts.push('noPatches');
    
    return opts.length > 0 ? `${base}:${opts.join(':')}` : base;
  }

  /**
   * Generate cache key for raw diff requests
   */
  static diffRawKey(ref: DiffReference): string {
    return `diff-raw:${ref.owner}:${ref.repo}:${ref.base}:${ref.head}`;
  }

  /**
   * Generate cache key for diff stats requests
   */
  static diffStatsKey(ref: DiffReference): string {
    return `diff-stats:${ref.owner}:${ref.repo}:${ref.base}:${ref.head}`;
  }

  /**
   * Generate cache key for commit requests
   */
  static commitKey(ref: CommitReference): string {
    return `commit:${ref.owner}:${ref.repo}:${ref.sha}`;
  }

  /**
   * Generate cache key for commit range requests
   */
  static commitRangeKey(ref: DiffReference): string {
    return `commits:${ref.owner}:${ref.repo}:${ref.base}:${ref.head}`;
  }

  /**
   * Generate cache key for repository requests
   */
  static repositoryKey(owner: string, repo: string): string {
    return `repo:${owner}:${repo}`;
  }

  /**
   * Generate cache key for rate limit requests
   */
  static rateLimitKey(): string {
    return 'rate-limit:github';
  }

  /**
   * Generate cache key for validation requests
   */
  static validationKey(type: 'diff' | 'commit', ref: DiffReference | CommitReference): string {
    if (type === 'commit') {
      const commitRef = ref as CommitReference;
      return `validate:commit:${commitRef.owner}:${commitRef.repo}:${commitRef.sha}`;
    } else {
      const diffRef = ref as DiffReference;
      return `validate:diff:${diffRef.owner}:${diffRef.repo}:${diffRef.base}:${diffRef.head}`;
    }
  }
}

/**
 * Factory function to create cache instance
 */
export function createCache(config?: Partial<CacheConfig>): ICache {
  return new MemoryCache(config);
}

/**
 * Default cache instance for GitHub API
 */
export const defaultGitHubCache = createCache({
  defaultTtl: 5 * 60 * 1000, // 5 minutes
  maxEntries: 500,
  maxMemory: 25 * 1024 * 1024, // 25MB
  cleanupInterval: 2 * 60 * 1000, // 2 minutes
  enableStats: true,
});

/**
 * Cache configuration for different data types
 */
export const CacheConfigs = {
  /** Fast-changing data (rate limits, validation) */
  SHORT_LIVED: { defaultTtl: 30 * 1000 }, // 30 seconds
  
  /** Medium-duration data (diffs, commits) */
  MEDIUM_LIVED: { defaultTtl: 5 * 60 * 1000 }, // 5 minutes
  
  /** Long-lived data (repository info) */
  LONG_LIVED: { defaultTtl: 30 * 60 * 1000 }, // 30 minutes
  
  /** Development mode (shorter TTL for testing) */
  DEVELOPMENT: { defaultTtl: 10 * 1000 }, // 10 seconds
}; 