/**
 * GitHub API Client
 * 
 * This module provides a configured GitHub API client using Octokit.
 * Follows dependency injection pattern for testability.
 */

import { Octokit } from '@octokit/rest';
import type { 
  RestEndpointMethodTypes,
} from '@octokit/rest';

// Type definitions for GitHub API responses
export type GitHubCommit = RestEndpointMethodTypes['repos']['getCommit']['response']['data'];
export type GitHubCommitDiff = RestEndpointMethodTypes['repos']['compareCommits']['response']['data'];

// Configuration interface
export interface GitHubClientConfig {
  auth: string;
  userAgent?: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
}

// Interface for GitHub API operations
export interface IGitHubApiClient {
  getCommit(owner: string, repo: string, ref: string): Promise<GitHubCommit>;
  getCommitDiff(owner: string, repo: string, base: string, head: string): Promise<GitHubCommitDiff>;
  getRepository(owner: string, repo: string): Promise<any>;
  getRateLimit(): Promise<any>;
  // Return raw unified diff text for compare
  getCommitDiffRaw(owner: string, repo: string, base: string, head: string): Promise<string>;
}

// Production implementation
export class GitHubApiClient implements IGitHubApiClient {
  private octokit: Octokit;

  constructor(config: GitHubClientConfig) {
    this.validateConfig(config);
    
    this.octokit = new Octokit({
      auth: config.auth,
      userAgent: config.userAgent || 'change-reel/1.0.0',
      baseUrl: config.baseUrl,
      request: {
        timeout: config.timeout || 10000,
        retries: config.retries || 3,
      },
    });
  }

  private validateConfig(config: GitHubClientConfig): void {
    if (typeof config.auth !== 'string') {
      throw new Error('GitHub API token must be a non-empty string');
    }

    if (!config.auth || config.auth.trim().length === 0) {
      throw new Error('GitHub API token is required');
    }

    // Validate token format (GitHub tokens start with specific prefixes)
    const validTokenPrefixes = ['ghp_', 'github_pat_', 'gho_', 'ghu_', 'ghs_', 'ghr_'];
    const hasValidPrefix = validTokenPrefixes.some(prefix => config.auth.startsWith(prefix));
    
    if (!hasValidPrefix) {
      throw new Error('Invalid GitHub token format. Token must start with a valid prefix (ghp_, github_pat_, etc.)');
    }
  }

  async getCommit(owner: string, repo: string, ref: string): Promise<GitHubCommit> {
    try {
      const response = await this.octokit.rest.repos.getCommit({
        owner,
        repo,
        ref,
      });
      return response.data;
    } catch (error) {
      throw this.handleApiError(error, 'getCommit');
    }
  }

  async getCommitDiff(owner: string, repo: string, base: string, head: string): Promise<GitHubCommitDiff> {
    try {
      const response = await this.octokit.rest.repos.compareCommits({
        owner,
        repo,
        base,
        head,
      });
      return response.data;
    } catch (error) {
      throw this.handleApiError(error, 'getCommitDiff');
    }
  }

  async getRepository(owner: string, repo: string): Promise<any> {
    try {
      const response = await this.octokit.rest.repos.get({
        owner,
        repo,
      });
      return response.data;
    } catch (error) {
      throw this.handleApiError(error, 'getRepository');
    }
  }

  async getRateLimit(): Promise<any> {
    try {
      const response = await this.octokit.rest.rateLimit.get();
      return response.data;
    } catch (error) {
      throw this.handleApiError(error, 'getRateLimit');
    }
  }

  async getCommitDiffRaw(owner: string, repo: string, base: string, head: string): Promise<string> {
    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/compare/{base}...{head}', {
        owner,
        repo,
        base,
        head,
        headers: {
          accept: 'application/vnd.github.v3.diff',
        },
      });
      // Octokit returns text when accept asks for diff
      return response.data as unknown as string;
    } catch (error) {
      throw this.handleApiError(error, 'getCommitDiffRaw');
    }
  }

  private handleApiError(error: any, operation: string): Error {
    if (error.status) {
      switch (error.status) {
        case 401:
          return new Error(`GitHub API authentication failed for ${operation}: Invalid or expired token`);
        case 403:
          if (error.response?.headers?.['x-ratelimit-remaining'] === '0') {
            return new Error(`GitHub API rate limit exceeded for ${operation}. Resets at: ${error.response.headers['x-ratelimit-reset']}`);
          }
          return new Error(`GitHub API access forbidden for ${operation}: ${error.message}`);
        case 404:
          return new Error(`GitHub API resource not found for ${operation}: ${error.message}`);
        case 422:
          return new Error(`GitHub API validation error for ${operation}: ${error.message}`);
        default:
          return new Error(`GitHub API error for ${operation} (${error.status}): ${error.message}`);
      }
    }
    
    return new Error(`GitHub API network error for ${operation}: ${error.message}`);
  }
}

// Factory function for creating GitHub client
export function createGitHubClient(config: GitHubClientConfig): IGitHubApiClient {
  return new GitHubApiClient(config);
}

// Factory function using environment variables
export function createGitHubClientFromEnv(): IGitHubApiClient {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_API_TOKEN;
  
  if (!token) {
    throw new Error('GitHub token not found. Set GITHUB_TOKEN or GITHUB_API_TOKEN environment variable.');
  }

  return createGitHubClient({
    auth: token,
    userAgent: 'change-reel/1.0.0',
    timeout: 10000,
    retries: 3,
  });
} 
