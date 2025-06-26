/**
 * GitHub Webhook Payload Parser
 * 
 * Parses GitHub webhook payloads to extract relevant commit information
 * for storage in our database and changelog generation.
 */

export interface GitHubWebhookCommit {
  id: string;
  message: string;
  timestamp: string;
  url: string;
  author: {
    name: string;
    email: string;
    username?: string;
  };
  committer: {
    name: string;
    email: string;
    username?: string;
  };
  added: string[];
  removed: string[];
  modified: string[];
}

export interface GitHubWebhookRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    name: string;
    login: string;
  };
  clone_url: string;
  html_url: string;
}

export interface GitHubPushPayload {
  ref: string;
  before: string;
  after: string;
  created: boolean;
  deleted: boolean;
  forced: boolean;
  base_ref: string | null;
  compare: string;
  commits: GitHubWebhookCommit[];
  head_commit: GitHubWebhookCommit | null;
  repository: GitHubWebhookRepository;
  pusher: {
    name: string;
    email: string;
  };
  sender: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  };
}

export interface ParsedCommitData {
  sha: string;
  message: string;
  author_name: string;
  author_email: string;
  author_username?: string;
  committer_name: string;
  committer_email: string;
  committer_username?: string;
  timestamp: string;
  url: string;
  branch: string;
  repository_name: string;
  repository_full_name: string;
  files_added: string[];
  files_removed: string[];
  files_modified: string[];
}

export interface WebhookParseResult {
  success: boolean;
  event_type: string;
  repository: {
    name: string;
    full_name: string;
    id: number;
  };
  commits?: ParsedCommitData[];
  branch?: string;
  error?: string;
}

export class GitHubWebhookParser {
  /**
   * Parse a GitHub webhook payload based on the event type
   */
  static parseWebhookPayload(
    eventType: string,
    payload: any
  ): WebhookParseResult {
    try {
      const repository = {
        name: payload.repository?.name || '',
        full_name: payload.repository?.full_name || '',
        id: payload.repository?.id || 0,
      };

      switch (eventType) {
        case 'push':
          return this.parsePushEvent(payload as GitHubPushPayload);
        
        case 'pull_request':
          return this.parsePullRequestEvent(payload);
        
        case 'release':
          return this.parseReleaseEvent(payload);
        
        default:
          return {
            success: true,
            event_type: eventType,
            repository,
            commits: [],
          };
      }
    } catch (error) {
      return {
        success: false,
        event_type: eventType,
        repository: {
          name: '',
          full_name: '',
          id: 0,
        },
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      };
    }
  }

  /**
   * Parse push event payload to extract commit information
   */
  private static parsePushEvent(payload: GitHubPushPayload): WebhookParseResult {
    try {
      const branch = this.extractBranchFromRef(payload.ref);
      const repository = {
        name: payload.repository.name,
        full_name: payload.repository.full_name,
        id: payload.repository.id,
      };

      // Skip if this is a tag push or branch deletion
      if (payload.deleted || payload.ref.startsWith('refs/tags/')) {
        return {
          success: true,
          event_type: 'push',
          repository,
          branch,
          commits: [],
        };
      }

      const commits: ParsedCommitData[] = payload.commits.map(commit => ({
        sha: commit.id,
        message: commit.message,
        author_name: commit.author.name,
        author_email: commit.author.email,
        author_username: commit.author.username,
        committer_name: commit.committer.name,
        committer_email: commit.committer.email,
        committer_username: commit.committer.username,
        timestamp: commit.timestamp,
        url: commit.url,
        branch,
        repository_name: repository.name,
        repository_full_name: repository.full_name,
        files_added: commit.added || [],
        files_removed: commit.removed || [],
        files_modified: commit.modified || [],
      }));

      return {
        success: true,
        event_type: 'push',
        repository,
        branch,
        commits,
      };
    } catch (error) {
      return {
        success: false,
        event_type: 'push',
        repository: {
          name: payload.repository?.name || '',
          full_name: payload.repository?.full_name || '',
          id: payload.repository?.id || 0,
        },
        error: error instanceof Error ? error.message : 'Failed to parse push event',
      };
    }
  }

  /**
   * Parse pull request event payload
   */
  private static parsePullRequestEvent(payload: any): WebhookParseResult {
    try {
      const repository = {
        name: payload.repository.name,
        full_name: payload.repository.full_name,
        id: payload.repository.id,
      };

      // For now, we don't extract commits from PR events
      // This could be extended in the future to handle PR merges
      return {
        success: true,
        event_type: 'pull_request',
        repository,
        commits: [],
      };
    } catch (error) {
      return {
        success: false,
        event_type: 'pull_request',
        repository: {
          name: payload.repository?.name || '',
          full_name: payload.repository?.full_name || '',
          id: payload.repository?.id || 0,
        },
        error: error instanceof Error ? error.message : 'Failed to parse pull request event',
      };
    }
  }

  /**
   * Parse release event payload
   */
  private static parseReleaseEvent(payload: any): WebhookParseResult {
    try {
      const repository = {
        name: payload.repository.name,
        full_name: payload.repository.full_name,
        id: payload.repository.id,
      };

      // For now, we don't extract commits from release events
      // This could be extended in the future to handle release notes
      return {
        success: true,
        event_type: 'release',
        repository,
        commits: [],
      };
    } catch (error) {
      return {
        success: false,
        event_type: 'release',
        repository: {
          name: payload.repository?.name || '',
          full_name: payload.repository?.full_name || '',
          id: payload.repository?.id || 0,
        },
        error: error instanceof Error ? error.message : 'Failed to parse release event',
      };
    }
  }

  /**
   * Extract branch name from Git ref
   */
  private static extractBranchFromRef(ref: string): string {
    if (ref.startsWith('refs/heads/')) {
      return ref.substring('refs/heads/'.length);
    }
    return ref;
  }

  /**
   * Validate that the payload contains required fields
   */
  static validatePayload(eventType: string, payload: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Common validations
    if (!payload.repository) {
      errors.push('Missing repository information');
    } else {
      if (!payload.repository.name) errors.push('Missing repository name');
      if (!payload.repository.full_name) errors.push('Missing repository full name');
      if (!payload.repository.id) errors.push('Missing repository id');
    }

    // Event-specific validations
    switch (eventType) {
      case 'push':
        if (!payload.ref) errors.push('Missing ref in push event');
        if (!Array.isArray(payload.commits)) errors.push('Missing or invalid commits array');
        break;
      
      case 'pull_request':
        if (!payload.pull_request) errors.push('Missing pull_request data');
        break;
      
      case 'release':
        if (!payload.release) errors.push('Missing release data');
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if the event should be processed (filters out irrelevant events)
   */
  static shouldProcessEvent(eventType: string, payload: any): boolean {
    switch (eventType) {
      case 'push':
        // Skip tag pushes and branch deletions
        return !payload.deleted && !payload.ref?.startsWith('refs/tags/');
      
      case 'pull_request':
        // Only process merged PRs for now
        return payload.action === 'closed' && payload.pull_request?.merged === true;
      
      case 'release':
        // Only process published releases
        return payload.action === 'published';
      
      default:
        // Skip all other event types for now
        return false;
    }
  }
} 