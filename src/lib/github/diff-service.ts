/**
 * GitHub Diff Service
 * 
 * Service for fetching and processing commit diffs from GitHub.
 * Handles pagination, large diffs, and diff parsing.
 */

import type { IGitHubApiClient } from './api-client';

export interface DiffReference {
  owner: string;
  repo: string;
  base: string;
  head: string;
}

export interface DiffFile {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
  sha: string;
  blob_url: string;
  raw_url: string;
}

export interface DiffStats {
  total_files: number;
  additions: number;
  deletions: number;
  total_changes: number;
}

export interface DiffData {
  files: DiffFile[];
  stats: DiffStats;
  commits: Array<{
    sha: string;
    message: string;
    author: string;
    date: string;
  }>;
  base_commit: string;
  head_commit: string;
  ahead_by: number;
  behind_by: number;
  status: 'ahead' | 'behind' | 'identical' | 'diverged';
}

export interface DiffOptions {
  includePatches?: boolean;
  maxFiles?: number;
  ignoreWhitespace?: boolean;
  format?: 'unified' | 'raw' | 'patch';
}

export interface IDiffService {
  getDiff(reference: DiffReference, options?: DiffOptions): Promise<DiffData>;
  getDiffRaw(reference: DiffReference): Promise<string>;
  getDiffStats(reference: DiffReference): Promise<DiffStats>;
  validateDiffReference(reference: DiffReference): Promise<boolean>;
}

export class GitHubDiffService implements IDiffService {
  constructor(private readonly apiClient: IGitHubApiClient) {}

  async getDiff(reference: DiffReference, options: DiffOptions = {}): Promise<DiffData> {
    try {
      const comparison = await this.apiClient.getCommitDiff(
        reference.owner,
        reference.repo,
        reference.base,
        reference.head
      );

      return this.transformGitHubComparison(comparison, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch diff for ${reference.base}..${reference.head}: ${errorMessage}`);
    }
  }

  async getDiffRaw(reference: DiffReference): Promise<string> {
    try {
      // Use authenticated Octokit client to request raw diff with correct user token
      return await this.apiClient.getCommitDiffRaw(
        reference.owner,
        reference.repo,
        reference.base,
        reference.head
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch raw diff for ${reference.base}..${reference.head}: ${errorMessage}`);
    }
  }

  async getDiffStats(reference: DiffReference): Promise<DiffStats> {
    try {
      const comparison = await this.apiClient.getCommitDiff(
        reference.owner,
        reference.repo,
        reference.base,
        reference.head
      );

      return {
        total_files: comparison.files?.length || 0,
        additions: comparison.files?.reduce((sum, file) => sum + (file.additions || 0), 0) || 0,
        deletions: comparison.files?.reduce((sum, file) => sum + (file.deletions || 0), 0) || 0,
        total_changes: comparison.files?.reduce((sum, file) => sum + (file.changes || 0), 0) || 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch diff stats for ${reference.base}..${reference.head}: ${errorMessage}`);
    }
  }

  async validateDiffReference(reference: DiffReference): Promise<boolean> {
    try {
      await this.apiClient.getCommitDiff(
        reference.owner,
        reference.repo,
        reference.base,
        reference.head
      );
      return true;
    } catch (error) {
      // If it's a 404 or comparison error, the reference is invalid
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('resource not found') || 
          errorMessage.includes('No common ancestor') ||
          errorMessage.includes('not found')) {
        return false;
      }
      // For other errors, re-throw as it might be a network/auth issue
      throw error;
    }
  }

  private transformGitHubComparison(comparison: any, options: DiffOptions): DiffData {
    const files = this.transformFiles(comparison.files || [], options);
    const commits = this.transformCommits(comparison.commits || []);

    return {
      files,
      stats: {
        total_files: files.length,
        additions: files.reduce((sum, file) => sum + file.additions, 0),
        deletions: files.reduce((sum, file) => sum + file.deletions, 0),
        total_changes: files.reduce((sum, file) => sum + file.changes, 0),
      },
      commits,
      base_commit: comparison.base_commit?.sha || comparison.merge_base_commit?.sha || '',
      head_commit: comparison.head_commit?.sha || '',
      ahead_by: comparison.ahead_by || 0,
      behind_by: comparison.behind_by || 0,
      status: this.determineStatus(comparison),
    };
  }

  private transformFiles(githubFiles: any[], options: DiffOptions): DiffFile[] {
    let files = githubFiles.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions || 0,
      deletions: file.deletions || 0,
      changes: file.changes || 0,
      patch: options.includePatches !== false ? file.patch : undefined,
      previous_filename: file.previous_filename,
      sha: file.sha || '',
      blob_url: file.blob_url || '',
      raw_url: file.raw_url || '',
    }));

    // Apply max files limit if specified
    if (options.maxFiles && files.length > options.maxFiles) {
      files = files.slice(0, options.maxFiles);
    }

    return files;
  }

  private transformCommits(githubCommits: any[]) {
    return githubCommits.map(commit => ({
      sha: commit.sha,
      message: commit.commit?.message || '',
      author: commit.commit?.author?.name || commit.author?.login || 'Unknown',
      date: commit.commit?.author?.date || commit.commit?.committer?.date || '',
    }));
  }

  private determineStatus(comparison: any): 'ahead' | 'behind' | 'identical' | 'diverged' {
    const aheadBy = comparison.ahead_by || 0;
    const behindBy = comparison.behind_by || 0;

    if (aheadBy === 0 && behindBy === 0) {
      return 'identical';
    } else if (aheadBy > 0 && behindBy === 0) {
      return 'ahead';
    } else if (aheadBy === 0 && behindBy > 0) {
      return 'behind';
    } else {
      return 'diverged';
    }
  }
}

// Factory function for creating diff service
export function createDiffService(apiClient: IGitHubApiClient): IDiffService {
  return new GitHubDiffService(apiClient);
}

// Utility functions for diff processing
export class DiffUtils {
  /**
   * Parse unified diff format into structured data
   */
  static parseUnifiedDiff(diffText: string): Array<{
    filename: string;
    hunks: Array<{
      oldStart: number;
      oldLines: number;
      newStart: number;
      newLines: number;
      lines: Array<{
        type: 'add' | 'remove' | 'context';
        content: string;
        lineNumber?: { old?: number; new?: number };
      }>;
    }>;
  }> {
    const files: any[] = [];
    const lines = diffText.split('\n');
    let currentFile: any = null;
    let currentHunk: any = null;
    let oldLineNumber = 0;
    let newLineNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // File header
      if (line.startsWith('diff --git')) {
        if (currentFile) files.push(currentFile);
        currentFile = { filename: '', hunks: [] };
        continue;
      }

      // File names
      if (line.startsWith('--- ') || line.startsWith('+++ ')) {
        if (currentFile && line.startsWith('+++ ')) {
          const filename = line.substring(6);
          currentFile.filename = filename === '/dev/null' ? '' : filename;
        }
        continue;
      }

      // Hunk header
      if (line.startsWith('@@')) {
        if (currentHunk) currentFile?.hunks.push(currentHunk);
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match) {
          oldLineNumber = parseInt(match[1]);
          newLineNumber = parseInt(match[3]);
          currentHunk = {
            oldStart: oldLineNumber,
            oldLines: parseInt(match[2] || '1'),
            newStart: newLineNumber,
            newLines: parseInt(match[4] || '1'),
            lines: [],
          };
        }
        continue;
      }

      // Content lines
      if (currentHunk && (line.startsWith(' ') || line.startsWith('+') || line.startsWith('-'))) {
        const type = line.startsWith('+') ? 'add' : line.startsWith('-') ? 'remove' : 'context';
        const content = line.substring(1);
        
        const lineData: any = { type, content };
        
        if (type === 'remove' || type === 'context') {
          lineData.lineNumber = { old: oldLineNumber++ };
        }
        if (type === 'add' || type === 'context') {
          lineData.lineNumber = { ...lineData.lineNumber, new: newLineNumber++ };
        }

        currentHunk.lines.push(lineData);
      }
    }

    // Add final hunk and file
    if (currentHunk) currentFile?.hunks.push(currentHunk);
    if (currentFile) files.push(currentFile);

    return files;
  }

  /**
   * Calculate diff statistics from parsed diff
   */
  static calculateStats(parsedDiff: ReturnType<typeof DiffUtils.parseUnifiedDiff>): DiffStats {
    let additions = 0;
    let deletions = 0;

    for (const file of parsedDiff) {
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.type === 'add') additions++;
          if (line.type === 'remove') deletions++;
        }
      }
    }

    return {
      total_files: parsedDiff.length,
      additions,
      deletions,
      total_changes: additions + deletions,
    };
  }
} 