import OpenAI from 'openai';
import { createDiffSummaryPrompt, createChangeTypePrompt, PromptTemplateEngine } from './prompt-templates';
import { OpenAIRateLimiter, defaultRateLimiter, OperationType } from './rate-limiter';
import { OpenAIErrorHandler, defaultErrorHandler } from './error-handler';

/**
 * Interface for OpenAI client to enable dependency injection and testing
 */
export interface IOpenAIClient {
  generateSummary(diff: string, promptTemplate?: string): Promise<string>;
  detectChangeType(diff: string, summary: string): Promise<'feature' | 'fix' | 'refactor' | 'chore'>;
}

/**
 * Configuration for OpenAI client
 */
export interface OpenAIClientConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  templateEngine?: PromptTemplateEngine;
  rateLimiter?: OpenAIRateLimiter;
  errorHandler?: OpenAIErrorHandler;
}

/**
 * OpenAI client implementation with dependency injection support
 */
export class OpenAIClient implements IOpenAIClient {
  private openai: OpenAI;
  private model: string;
  private maxTokens: number;
  private templateEngine: PromptTemplateEngine;
  private rateLimiter: OpenAIRateLimiter;
  private errorHandler: OpenAIErrorHandler;

  constructor(config: OpenAIClientConfig) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.openai = new OpenAI({
      apiKey: config.apiKey,
    });

    this.model = config.model || process.env.OPENAI_MODEL || 'gpt-5';
    this.maxTokens = config.maxTokens || 150;
    this.templateEngine = config.templateEngine || new PromptTemplateEngine();
    this.rateLimiter = config.rateLimiter || defaultRateLimiter;
    this.errorHandler = config.errorHandler || defaultErrorHandler;
  }

  /**
   * Generate a summary for the given diff using OpenAI
   */
  async generateSummary(diff: string, promptTemplate?: string): Promise<string> {
    if (!diff.trim()) {
      throw new Error('Diff content is required');
    }

    return this.errorHandler.executeWithRetry(async () => {
      // Use template engine for prompt generation
      const prompt = promptTemplate 
        ? this.templateEngine.createCustomPrompt(promptTemplate, { diff })
        : this.templateEngine.createDiffSummaryPrompt(diff);

      // Estimate tokens for rate limiting (rough estimate)
      const estimatedTokens = Math.ceil((prompt.length + this.maxTokens) / 3);
      
      // Check rate limit before making the API call
      const rateLimitResult = await this.rateLimiter.checkRateLimit('summarization', estimatedTokens);
      if (!rateLimitResult.allowed) {
        const waitTime = rateLimitResult.retryAfterMs || 1000;
        throw new Error(`Rate limit exceeded. Retry after ${waitTime}ms. Remaining tokens: ${rateLimitResult.remainingTokens}`);
      }

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a changelog assistant that creates concise, clear summaries of code changes.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: this.maxTokens,
      });

      const summary = response.choices[0]?.message?.content?.trim();
      
      if (!summary) {
        throw new Error('No summary generated from OpenAI response');
      }

      return summary;
    }, 'summarization');
  }

  /**
   * Detect the type of change based on diff and summary
   */
  async detectChangeType(diff: string, summary: string): Promise<'feature' | 'fix' | 'refactor' | 'chore'> {
    return this.errorHandler.executeWithRetry(async () => {
      // Use template engine for change type detection prompt
      const prompt = this.templateEngine.createChangeTypePrompt(diff, summary);

      // Estimate tokens for rate limiting (change detection uses fewer tokens)
      const estimatedTokens = Math.ceil((prompt.length + 10) / 3); // Only 10 max tokens for output
      
      // Check rate limit before making the API call
      const rateLimitResult = await this.rateLimiter.checkRateLimit('change_detection', estimatedTokens);
      if (!rateLimitResult.allowed) {
        const waitTime = rateLimitResult.retryAfterMs || 1000;
        throw new Error(`Rate limit exceeded for change type detection. Retry after ${waitTime}ms. Remaining tokens: ${rateLimitResult.remainingTokens}`);
      }

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a code change categorization assistant. Respond with only one word: feature, fix, refactor, or chore.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: 10,
      });

      const category = response.choices[0]?.message?.content?.trim().toLowerCase();
      
      if (!category || !['feature', 'fix', 'refactor', 'chore'].includes(category)) {
        throw new Error(`Invalid change type returned by OpenAI: "${category}". Expected one of: feature, fix, refactor, chore`);
      }

      return category as 'feature' | 'fix' | 'refactor' | 'chore';
    }, 'change_detection');
  }

  /**
   * Get the template engine instance for custom operations
   */
  getTemplateEngine(): PromptTemplateEngine {
    return this.templateEngine;
  }


}

/**
 * Factory function to create OpenAI client with environment configuration
 */
export function createOpenAIClient(config?: Partial<OpenAIClientConfig>): OpenAIClient {
  const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  return new OpenAIClient({
    apiKey,
    model: config?.model,
    maxTokens: config?.maxTokens,
    templateEngine: config?.templateEngine,
    rateLimiter: config?.rateLimiter,
    errorHandler: config?.errorHandler,
  });
} 