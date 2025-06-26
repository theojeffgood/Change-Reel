/**
 * GitHub Commit Service
 * 
 * Service for fetching commit details and metadata from GitHub.
 * Follows dependency injection pattern for testability.
 */

import type { IGitHubApiClient, GitHubCommit } from './api-client';

export interface CommitReference {
  owner: string;
  repo: string;
  sha: string;
}

export interface CommitDetails {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
  url: string;
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
  files: CommitFile[];
}

export interface CommitFile {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export interface ICommitService {
  getCommitDetails(reference: CommitReference): Promise<CommitDetails>;
  getCommitsByRange(owner: string, repo: string, base: string, head: string): Promise<CommitDetails[]>;
  validateCommitExists(reference: CommitReference): Promise<boolean>;
}

export class GitHubCommitService implements ICommitService {
  constructor(private readonly apiClient: IGitHubApiClient) {}

  async getCommitDetails(reference: CommitReference): Promise<CommitDetails> {
    try {
      const commit = await this.apiClient.getCommit(reference.owner, reference.repo, reference.sha);
      return this.transformGitHubCommit(commit);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch commit details for ${reference.sha}: ${errorMessage}`);
    }
  }

  async getCommitsByRange(owner: string, repo: string, base: string, head: string): Promise<CommitDetails[]> {
    try {
      // Get comparison data which includes commits
      const comparison = await this.apiClient.getCommitDiff(owner, repo, base, head);
      
      // Extract commits from comparison and fetch full details for each
      const commitPromises = comparison.commits?.map(commit => 
        this.getCommitDetails({ owner, repo, sha: commit.sha })
      ) || [];

      return Promise.all(commitPromises);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch commits in range ${base}..${head}: ${errorMessage}`);
    }
  }

  async validateCommitExists(reference: CommitReference): Promise<boolean> {
    try {
      await this.apiClient.getCommit(reference.owner, reference.repo, reference.sha);
      return true;
    } catch (error) {
      // If it's a 404, the commit doesn't exist
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('resource not found')) {
        return false;
      }
      // For other errors, re-throw as it might be a network/auth issue
      throw error;
    }
  }

  private transformGitHubCommit(githubCommit: GitHubCommit): CommitDetails {
    return {
      sha: githubCommit.sha,
      message: githubCommit.commit.message,
      author: {
        name: githubCommit.commit.author?.name || 'Unknown',
        email: githubCommit.commit.author?.email || '',
        date: githubCommit.commit.author?.date || '',
      },
      committer: {
        name: githubCommit.commit.committer?.name || 'Unknown',
        email: githubCommit.commit.committer?.email || '',
        date: githubCommit.commit.committer?.date || '',
      },
      url: githubCommit.html_url || '',
      stats: {
        additions: githubCommit.stats?.additions || 0,
        deletions: githubCommit.stats?.deletions || 0,
        total: githubCommit.stats?.total || 0,
      },
      files: this.transformFiles(githubCommit.files || []),
    };
  }

  private transformFiles(githubFiles: any[]): CommitFile[] {
    return githubFiles.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions || 0,
      deletions: file.deletions || 0,
      changes: file.changes || 0,
      patch: file.patch,
      previous_filename: file.previous_filename,
    }));
  }
}

// Factory function for creating commit service
export function createCommitService(apiClient: IGitHubApiClient): ICommitService {
  return new GitHubCommitService(apiClient);
} 