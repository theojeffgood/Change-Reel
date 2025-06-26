import { GitHubWebhookParser } from './webhook-parser';
import { GitHubWebhookService } from './webhook-service';
import { createSupabaseServices, ISupabaseServices } from '../supabase/services';
import { SupabaseClient } from '@supabase/supabase-js';

export interface WebhookValidationResult {
  success: boolean;
  error?: string;
  statusCode?: number;
}

export interface WebhookProcessingResult {
  success: boolean;
  message: string;
  processed?: number;
  error?: string;
  statusCode?: number;
}

export interface WebhookProcessingRequest {
  event: string;
  signature: string;
  delivery: string;
  userAgent?: string;
  payload: any;
  rawBody: string;
}

export interface WebhookProcessingDependencies {
  supabaseServices: ISupabaseServices;
  webhookParser: typeof GitHubWebhookParser;
  webhookService: typeof GitHubWebhookService;
}

/**
 * Service responsible for processing GitHub webhooks with dependency injection
 */
export class WebhookProcessingService {
  private dependencies: WebhookProcessingDependencies;

  constructor(dependencies: WebhookProcessingDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Create a new instance with default dependencies
   */
  static createWithDefaults(supabaseClient: SupabaseClient): WebhookProcessingService {
    return new WebhookProcessingService({
      supabaseServices: createSupabaseServices(supabaseClient),
      webhookParser: GitHubWebhookParser,
      webhookService: GitHubWebhookService
    });
  }

  /**
   * Validate webhook request headers and basic requirements
   */
  validateWebhookRequest(request: WebhookProcessingRequest): WebhookValidationResult {
    // Validate User-Agent header for GitHub webhooks
    if (request.userAgent && !request.userAgent.startsWith('GitHub-Hookshot/')) {
      return {
        success: false,
        error: 'invalid user agent - expected GitHub-Hookshot',
        statusCode: 400
      };
    }

    // Validate payload structure
    const validation = this.dependencies.webhookParser.validatePayload(request.event, request.payload);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', '),
        statusCode: 400
      };
    }

    return { success: true };
  }

  /**
   * Check if the webhook event should be processed
   */
  shouldProcessEvent(request: WebhookProcessingRequest): boolean {
    return this.dependencies.webhookParser.shouldProcessEvent(request.event, request.payload);
  }

  /**
   * Parse the webhook payload
   */
  parseWebhookPayload(request: WebhookProcessingRequest) {
    return this.dependencies.webhookParser.parseWebhookPayload(request.event, request.payload);
  }

  /**
   * Find project by repository name
   */
  async findProjectByRepository(repositoryName: string) {
    return this.dependencies.supabaseServices.projects.getProjectByRepository(repositoryName);
  }

  /**
   * Verify webhook signature
   */
  verifySignature(rawBody: string, signature: string, secret: string): boolean {
    return this.dependencies.webhookService.validateWebhookSignature(rawBody, signature, secret);
  }

  /**
   * Process commits from the parsed webhook payload
   */
  async processCommits(commits: any[], projectId: string): Promise<{
    processed: number;
    errors: string[];
  }> {
    let processedCount = 0;
    const processingErrors: string[] = [];

    for (const commitData of commits) {
      try {
        const commitResult = await this.dependencies.supabaseServices.commits.createCommit({
          project_id: projectId,
          sha: commitData.sha,
          author: `${commitData.author_name} <${commitData.author_email}>`,
          timestamp: commitData.timestamp,
          summary: commitData.message,
          type: 'feature', // Will be enhanced later with AI categorization
          is_published: false,
          email_sent: false
        });

        if (commitResult.error) {
          console.error(`Failed to create commit ${commitData.sha}:`, commitResult.error);
          processingErrors.push(`Failed to create commit ${commitData.sha}: ${commitResult.error.message}`);
        } else {
          processedCount++;
        }
      } catch (error) {
        console.error(`Error processing commit ${commitData.sha}:`, error);
        processingErrors.push(`Error processing commit ${commitData.sha}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { processed: processedCount, errors: processingErrors };
  }

  /**
   * Process a complete webhook request
   */
  async processWebhook(request: WebhookProcessingRequest): Promise<WebhookProcessingResult> {
    try {
      // Validate webhook request
      const validation = this.validateWebhookRequest(request);
      if (!validation.success) {
        return {
          success: false,
          message: 'Invalid webhook request',
          error: validation.error,
          statusCode: validation.statusCode
        };
      }

      // Check if we should process this event type
      const shouldProcess = this.shouldProcessEvent(request);
      if (!shouldProcess) {
        return {
          success: true,
          message: `Event type '${request.event}' filtered out - not processed`,
          processed: 0,
          statusCode: 200
        };
      }

      // Parse the webhook payload
      const parseResult = this.parseWebhookPayload(request);
      if (!parseResult.success) {
        return {
          success: false,
          message: 'Failed to parse webhook payload',
          error: parseResult.error,
          statusCode: 400
        };
      }

      // Find the project by repository name
      const projectResult = await this.findProjectByRepository(parseResult.repository.full_name);
      if (projectResult.error || !projectResult.data) {
        return {
          success: false,
          message: `No project found for repository: ${parseResult.repository.full_name}`,
          error: `repository not configured: ${parseResult.repository.full_name}`,
          statusCode: 404
        };
      }

      const project = projectResult.data;

      // Verify webhook signature with project secret
      if (!project.webhook_secret) {
        return {
          success: false,
          message: 'Project webhook secret not configured',
          statusCode: 500
        };
      }

      const isValidSignature = this.verifySignature(
        request.rawBody,
        request.signature,
        project.webhook_secret
      );

      if (!isValidSignature) {
        return {
          success: false,
          message: 'Invalid webhook signature',
          error: 'invalid signature verification failed',
          statusCode: 401
        };
      }

      // Process commits if any were parsed
      let processedCount = 0;
      let processingErrors: string[] = [];

      if (parseResult.commits && parseResult.commits.length > 0) {
        const result = await this.processCommits(parseResult.commits, project.id);
        processedCount = result.processed;
        processingErrors = result.errors;
      }

      // If there were critical processing errors and no commits were processed, return error
      if (processingErrors.length > 0 && processedCount === 0) {
        return {
          success: false,
          message: 'Failed to process webhook',
          error: 'processing failed - database errors occurred',
          statusCode: 500
        };
      }

      // Log successful processing
      console.log(`Webhook processed: ${request.event} event for ${parseResult.repository.full_name}, ${processedCount} commits stored`);

      return {
        success: true,
        message: `Successfully processed ${request.event} event`,
        processed: processedCount,
        statusCode: 200
      };

    } catch (error) {
      console.error('Webhook processing error:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }
} 