/**
 * GitHub Webhook Service
 * 
 * This service handles creating, managing, and deleting GitHub webhooks
 * for repositories using the stored OAuth tokens. It provides automatic
 * webhook setup for monitoring repository changes.
 */

import { getOAuthToken } from '@/lib/auth/token-storage';

interface GitHubWebhook {
  id: number;
  name: string;
  active: boolean;
  events: string[];
  config: {
    url: string;
    content_type: string;
    secret?: string;
    insecure_ssl: string;
  };
  created_at: string;
  updated_at: string;
}

interface CreateWebhookParams {
  owner: string;
  repo: string;
  webhookUrl: string;
  secret?: string;
  events?: string[];
}

interface WebhookServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export class GitHubWebhookService {
  private static readonly DEFAULT_EVENTS = [
    'push',
    'pull_request',
    'release',
    'create', // Branch/tag creation
    'delete'  // Branch/tag deletion
  ];

  /**
   * Create a webhook for a repository
   */
  static async createWebhook(
    userId: string,
    params: CreateWebhookParams
  ): Promise<WebhookServiceResult<GitHubWebhook>> {
    try {
      // Get the user's OAuth token
      const tokenResult = await getOAuthToken(userId, 'github');
      if (tokenResult.error || !tokenResult.token) {
        return {
          success: false,
          error: tokenResult.error || 'GitHub OAuth token not found. Please re-authenticate.',
          statusCode: 401
        };
      }

      const { owner, repo, webhookUrl, secret, events = GitHubWebhookService.DEFAULT_EVENTS } = params;

      // Prepare webhook configuration
      const webhookConfig = {
        name: 'web',
        active: true,
        events,
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: secret || GitHubWebhookService.generateWebhookSecret(),
          insecure_ssl: '0' // Always require SSL for security
        }
      };

      // Create webhook via GitHub API
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/hooks`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenResult.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Wins-Column-App/1.0'
          },
          body: JSON.stringify(webhookConfig)
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: responseData.message || 'Failed to create webhook',
          statusCode: response.status,
          data: responseData
        };
      }

      return {
        success: true,
        data: responseData,
        statusCode: response.status
      };

    } catch (error) {
      console.error('Error creating webhook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        statusCode: 500
      };
    }
  }

  /**
   * List all webhooks for a repository
   */
  static async listWebhooks(
    userId: string,
    owner: string,
    repo: string
  ): Promise<WebhookServiceResult<GitHubWebhook[]>> {
    try {
      const tokenResult = await getOAuthToken(userId, 'github');
      if (tokenResult.error || !tokenResult.token) {
        return {
          success: false,
          error: tokenResult.error || 'GitHub OAuth token not found. Please re-authenticate.',
          statusCode: 401
        };
      }

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/hooks`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenResult.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Wins-Column-App/1.0'
          }
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: responseData.message || 'Failed to list webhooks',
          statusCode: response.status,
          data: responseData
        };
      }

      return {
        success: true,
        data: responseData,
        statusCode: response.status
      };

    } catch (error) {
      console.error('Error listing webhooks:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        statusCode: 500
      };
    }
  }

  /**
   * Delete a webhook
   */
  static async deleteWebhook(
    userId: string,
    owner: string,
    repo: string,
    webhookId: number
  ): Promise<WebhookServiceResult<void>> {
    try {
      const tokenResult = await getOAuthToken(userId, 'github');
      if (tokenResult.error || !tokenResult.token) {
        return {
          success: false,
          error: tokenResult.error || 'GitHub OAuth token not found. Please re-authenticate.',
          statusCode: 401
        };
      }

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/hooks/${webhookId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${tokenResult.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Wins-Column-App/1.0'
          }
        }
      );

      if (!response.ok) {
        const responseData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: responseData.message || 'Failed to delete webhook',
          statusCode: response.status,
          data: responseData
        };
      }

      return {
        success: true,
        statusCode: response.status
      };

    } catch (error) {
      console.error('Error deleting webhook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        statusCode: 500
      };
    }
  }

  /**
   * Update a webhook
   */
  static async updateWebhook(
    userId: string,
    owner: string,
    repo: string,
    webhookId: number,
    updates: Partial<CreateWebhookParams>
  ): Promise<WebhookServiceResult<GitHubWebhook>> {
    try {
      const tokenResult = await getOAuthToken(userId, 'github');
      if (tokenResult.error || !tokenResult.token) {
        return {
          success: false,
          error: tokenResult.error || 'GitHub OAuth token not found. Please re-authenticate.',
          statusCode: 401
        };
      }

      // Build update payload
      const updatePayload: any = {
        active: true
      };

      if (updates.events) {
        updatePayload.events = updates.events;
      }

      if (updates.webhookUrl || updates.secret) {
        updatePayload.config = {};
        if (updates.webhookUrl) {
          updatePayload.config.url = updates.webhookUrl;
        }
        if (updates.secret) {
          updatePayload.config.secret = updates.secret;
        }
      }

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/hooks/${webhookId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${tokenResult.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Wins-Column-App/1.0'
          },
          body: JSON.stringify(updatePayload)
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: responseData.message || 'Failed to update webhook',
          statusCode: response.status,
          data: responseData
        };
      }

      return {
        success: true,
        data: responseData,
        statusCode: response.status
      };

    } catch (error) {
      console.error('Error updating webhook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        statusCode: 500
      };
    }
  }

  /**
   * Check if a webhook with our URL already exists
   */
  static async findExistingWebhook(
    userId: string,
    owner: string,
    repo: string,
    targetUrl: string
  ): Promise<WebhookServiceResult<GitHubWebhook | null>> {
    try {
      const listResult = await GitHubWebhookService.listWebhooks(userId, owner, repo);
      
      if (!listResult.success) {
        return {
          success: false,
          error: listResult.error,
          statusCode: listResult.statusCode
        };
      }

      const existingWebhook = listResult.data?.find(webhook => 
        webhook.config.url === targetUrl
      ) || null;

      return {
        success: true,
        data: existingWebhook
      };

    } catch (error) {
      console.error('Error finding existing webhook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        statusCode: 500
      };
    }
  }

  /**
   * Set up webhook for a repository (create or update existing)
   */
  static async setupRepositoryWebhook(
    userId: string,
    owner: string,
    repo: string,
    webhookUrl: string,
    events?: string[],
    secret?: string
  ): Promise<WebhookServiceResult<GitHubWebhook>> {
    try {
      // First, check if webhook already exists
      const existingResult = await GitHubWebhookService.findExistingWebhook(
        userId, 
        owner, 
        repo, 
        webhookUrl
      );

      if (!existingResult.success) {
        return {
          success: false,
          error: existingResult.error,
          statusCode: existingResult.statusCode
        };
      }

      if (existingResult.data) {
        // Webhook exists, update it if needed
        const webhook = existingResult.data;
        const currentEvents = webhook.events || [];
        const targetEvents = events || GitHubWebhookService.DEFAULT_EVENTS;

        // Check if events need updating
        const eventsMatch = targetEvents.length === currentEvents.length &&
          targetEvents.every(event => currentEvents.includes(event));

        if (webhook.active && eventsMatch) {
          // Webhook is already configured correctly
          return {
            success: true,
            data: webhook
          };
        } else {
          // Update the webhook
          return await GitHubWebhookService.updateWebhook(
            userId,
            owner,
            repo,
            webhook.id,
            { events: targetEvents }
          );
        }
      } else {
        // Create new webhook
        return await GitHubWebhookService.createWebhook(userId, {
          owner,
          repo,
          webhookUrl,
          events,
          secret
        });
      }

    } catch (error) {
      console.error('Error setting up repository webhook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        statusCode: 500
      };
    }
  }

  /**
   * Generate a cryptographically secure webhook secret
   */
  private static generateWebhookSecret(): string {
    // Generate a random 32-byte secret and encode as hex (Node-only)
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate webhook signature (for incoming webhook payloads)
   */
  static validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const calculatedSignature = `sha256=${hmac.digest('hex')}`;
      
      // Use timingSafeEqual to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(calculatedSignature)
      );
    } catch (error) {
      console.error('Error validating webhook signature:', error);
      return false;
    }
  }

  /**
   * Generate the webhook URL for this application
   */
  static generateWebhookUrl(baseUrl: string, repositoryId?: string): string {
    const endpoint = repositoryId 
      ? `/api/webhooks/github/${repositoryId}`
      : '/api/webhooks/github';
    
    return `${baseUrl.replace(/\/$/, '')}${endpoint}`;
  }

  /**
   * Check if user has sufficient permissions to create webhooks
   */
  static async checkWebhookPermissions(
    userId: string,
    owner: string,
    repo: string
  ): Promise<WebhookServiceResult<{ canCreateWebhooks: boolean; permissions: any }>> {
    try {
      const tokenResult = await getOAuthToken(userId, 'github');
      if (tokenResult.error || !tokenResult.token) {
        return {
          success: false,
          error: tokenResult.error || 'GitHub OAuth token not found. Please re-authenticate.',
          statusCode: 401
        };
      }

      // Get repository information including permissions
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenResult.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Wins-Column-App/1.0'
          }
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: responseData.message || 'Failed to check repository permissions',
          statusCode: response.status,
          data: responseData
        };
      }

      const permissions = responseData.permissions || {};
      const canCreateWebhooks = permissions.admin === true || permissions.push === true;

      return {
        success: true,
        data: {
          canCreateWebhooks,
          permissions
        }
      };

    } catch (error) {
      console.error('Error checking webhook permissions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        statusCode: 500
      };
    }
  }
} 