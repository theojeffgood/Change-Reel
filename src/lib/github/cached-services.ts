/**
 * Cache-Aware GitHub Services
 * 
 * Wrapper services that add caching functionality to existing GitHub API services.
 * These services respect the original interfaces while adding transparent caching.
 */

import type { IGitHubApiClient } from './api-client';
import type { ICommitService, CommitReference, CommitDetails } from './commit-service';
import type { IDiffService, DiffReference, DiffData, DiffOptions } from './diff-service';
import type { ICache } from './cache';
import { CacheKeyUtils, CacheConfigs } from './cache';

/**
 * Cache-aware GitHub API client wrapper
 */
export class CachedGitHubApiClient implements IGitHubApiClient {
  constructor(
    private readonly client: IGitHubApiClient,
    private readonly cache: ICache
  ) {}

  async getCommit(owner: string, repo: string, ref: string): Promise<any> {
    const key = CacheKeyUtils.commitKey({ owner, repo, sha: ref });
    
    // Try cache first
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    // Fetch from API and cache result
    const result = await this.client.getCommit(owner, repo, ref);
    this.cache.set(key, result, CacheConfigs.MEDIUM_LIVED.defaultTtl);
    
    return result;
  }

  async getCommitDiff(owner: string, repo: string, base: string, head: string): Promise<any> {
    const key = CacheKeyUtils.diffRawKey({ owner, repo, base, head });
    
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const result = await this.client.getCommitDiff(owner, repo, base, head);
    this.cache.set(key, result, CacheConfigs.MEDIUM_LIVED.defaultTtl);
    
    return result;
  }

  async getRepository(owner: string, repo: string) {
    const key = CacheKeyUtils.repositoryKey(owner, repo);
    
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const result = await this.client.getRepository(owner, repo);
    this.cache.set(key, result, CacheConfigs.LONG_LIVED.defaultTtl);
    
    return result;
  }

  async getRateLimit() {
    const key = CacheKeyUtils.rateLimitKey();
    
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const result = await this.client.getRateLimit();
    this.cache.set(key, result, CacheConfigs.SHORT_LIVED.defaultTtl);
    
    return result;
  }

  async getCommitDiffRaw(owner: string, repo: string, base: string, head: string): Promise<string> {
    const key = CacheKeyUtils.diffRawKey({ owner, repo, base, head });
    const cached = this.cache.get<string>(key);
    if (cached) {
      return cached;
    }

    const result = await this.client.getCommitDiffRaw(owner, repo, base, head);
    this.cache.set(key, result, CacheConfigs.MEDIUM_LIVED.defaultTtl);
    return result;
  }
}

/**
 * Cache-aware commit service wrapper
 */
export class CachedCommitService implements ICommitService {
  constructor(
    private readonly service: ICommitService,
    private readonly cache: ICache
  ) {}

  async getCommitDetails(ref: CommitReference): Promise<CommitDetails> {
    const key = CacheKeyUtils.commitKey(ref);
    
    const cached = this.cache.get<CommitDetails>(key);
    if (cached) {
      return cached;
    }

    const result = await this.service.getCommitDetails(ref);
    this.cache.set(key, result, CacheConfigs.MEDIUM_LIVED.defaultTtl);
    
    return result;
  }

  async getCommitsByRange(owner: string, repo: string, base: string, head: string): Promise<CommitDetails[]> {
    const key = CacheKeyUtils.commitRangeKey({ owner, repo, base, head });
    
    const cached = this.cache.get<CommitDetails[]>(key);
    if (cached) {
      return cached;
    }

    const result = await this.service.getCommitsByRange(owner, repo, base, head);
    this.cache.set(key, result, CacheConfigs.MEDIUM_LIVED.defaultTtl);
    
    return result;
  }

  async validateCommitExists(ref: CommitReference): Promise<boolean> {
    const key = CacheKeyUtils.validationKey('commit', ref);
    
    const cached = this.cache.get<boolean>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await this.service.validateCommitExists(ref);
    this.cache.set(key, result, CacheConfigs.SHORT_LIVED.defaultTtl);
    
    return result;
  }
}

/**
 * Cache-aware diff service wrapper
 */
export class CachedDiffService implements IDiffService {
  constructor(
    private readonly service: IDiffService,
    private readonly cache: ICache
  ) {}

  async getDiff(ref: DiffReference, options?: DiffOptions): Promise<DiffData> {
    const key = CacheKeyUtils.diffKey(ref, options);
    
    const cached = this.cache.get<DiffData>(key);
    if (cached) {
      return cached;
    }

    const result = await this.service.getDiff(ref, options);
    this.cache.set(key, result, CacheConfigs.MEDIUM_LIVED.defaultTtl);
    
    return result;
  }

  async getDiffRaw(ref: DiffReference): Promise<string> {
    const key = CacheKeyUtils.diffRawKey(ref);
    
    const cached = this.cache.get<string>(key);
    if (cached) {
      return cached;
    }

    const result = await this.service.getDiffRaw(ref);
    this.cache.set(key, result, CacheConfigs.MEDIUM_LIVED.defaultTtl);
    
    return result;
  }

  async getDiffStats(reference: DiffReference): Promise<{ total_files: number; additions: number; deletions: number; total_changes: number }> {
    const key = CacheKeyUtils.diffStatsKey(reference);
    
    const cached = this.cache.get<{ total_files: number; additions: number; deletions: number; total_changes: number }>(key);
    if (cached) {
      return cached;
    }

    const result = await this.service.getDiffStats(reference);
    this.cache.set(key, result, CacheConfigs.MEDIUM_LIVED.defaultTtl);
    
    return result;
  }

  async validateDiffReference(ref: DiffReference): Promise<boolean> {
    const key = CacheKeyUtils.validationKey('diff', ref);
    
    const cached = this.cache.get<boolean>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await this.service.validateDiffReference(ref);
    this.cache.set(key, result, CacheConfigs.SHORT_LIVED.defaultTtl);
    
    return result;
  }
}

/**
 * Cache statistics and monitoring utilities
 */
export class CacheMonitor {
  constructor(private readonly cache: ICache) {}

  /**
   * Get current cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Get formatted cache statistics for logging
   */
  getFormattedStats(): string {
    const stats = this.getStats();
    return [
      `Cache Stats:`,
      `  Entries: ${stats.entries}`,
      `  Memory: ${(stats.memoryUsage / 1024 / 1024).toFixed(1)}MB`,
      `  Hit Rate: ${stats.hitRate.toFixed(1)}%`,
      `  Hits: ${stats.hits}`,
      `  Misses: ${stats.misses}`,
      `  Evictions: ${stats.evictions}`,
    ].join('\n');
  }

  /**
   * Check if cache performance is healthy
   */
  isHealthy(): boolean {
    const stats = this.getStats();
    const totalRequests = stats.hits + stats.misses;
    
    // Consider cache healthy if:
    // - Hit rate is above 50%
    // - We have reasonable number of requests
    return totalRequests > 10 && stats.hitRate > 50;
  }

  /**
   * Get cache performance recommendations
   */
  getRecommendations(): string[] {
    const stats = this.getStats();
    const recommendations: string[] = [];
    
    if (stats.hitRate < 30) {
      recommendations.push('Consider increasing cache TTL - hit rate is low');
    }
    
    if (stats.evictions > stats.hits) {
      recommendations.push('Consider increasing cache size - too many evictions');
    }
    
    if (stats.memoryUsage > 40 * 1024 * 1024) { // 40MB
      recommendations.push('High memory usage - consider reducing cache size');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Cache performance looks good');
    }
    
    return recommendations;
  }

  /**
   * Force cleanup of expired entries
   */
  cleanup(): number {
    return this.cache.cleanup();
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Factory functions for creating cached services
 */
export function createCachedGitHubClient(
  client: IGitHubApiClient,
  cache: ICache
): IGitHubApiClient {
  return new CachedGitHubApiClient(client, cache);
}

export function createCachedCommitService(
  service: ICommitService,
  cache: ICache
): ICommitService {
  return new CachedCommitService(service, cache);
}

export function createCachedDiffService(
  service: IDiffService,
  cache: ICache
): IDiffService {
  return new CachedDiffService(service, cache);
}

/**
 * Utility function to create all cached services at once
 */
export function createCachedServices(
  client: IGitHubApiClient,
  commitService: ICommitService,
  diffService: IDiffService,
  cache: ICache
) {
  return {
    client: createCachedGitHubClient(client, cache),
    commitService: createCachedCommitService(commitService, cache),
    diffService: createCachedDiffService(diffService, cache),
    monitor: new CacheMonitor(cache),
  };
} 