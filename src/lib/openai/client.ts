import OpenAI from 'openai';
import {
  createDiffSummaryPrompt,
  createChangeTypePrompt,
  PromptTemplateEngine,
  DiffSummaryPromptOptions,
} from './prompt-templates';
import { OpenAIRateLimiter, defaultRateLimiter, OperationType } from './rate-limiter';
import { OpenAIErrorHandler, defaultErrorHandler, OpenAIError } from './error-handler';
import {
  CHANGE_TYPE_SYSTEM_PROMPT,
  DIFF_SUMMARY_SYSTEM_PROMPT,
} from './prompts';

// Safe JSON stringify helper to avoid huge logs and circular refs
function safeStringify(obj: any, maxLen: number = 20000): string {
  try {
    const seen = new WeakSet<any>();
    const json = JSON.stringify(
      obj,
      (key, value) => {
        if (typeof value === 'string') {
          if (value.length > 4000) return value.slice(0, 4000) + '...<truncated>'; // cap long strings
          return value;
        }
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      },
      2
    );
    return json.length > maxLen ? json.slice(0, maxLen) + '...<truncated>' : json;
  } catch (e) {
    return String(obj);
  }
}

/**
 * Interface for OpenAI client to enable dependency injection and testing
 */
export interface IOpenAIClient {
  // customContext is optional additional guidance appended to the prompt; NOT a template
  generateSummary(diff: string, options?: DiffSummaryPromptOptions): Promise<string>;
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
    const envMax = parseInt(process.env.OPENAI_MAX_TOKENS || '', 10);
    this.maxTokens = config.maxTokens || (Number.isFinite(envMax) ? envMax : 1000);
    this.templateEngine = config.templateEngine || new PromptTemplateEngine();
    this.rateLimiter = config.rateLimiter || defaultRateLimiter;
    this.errorHandler = config.errorHandler || defaultErrorHandler;
  }

  /**
   * Generate a summary for the given diff using OpenAI
   */
  async generateSummary(diff: string, options?: DiffSummaryPromptOptions): Promise<string> {
    if (!diff.trim()) {
      throw new Error('Diff content is required');
    }

    return this.errorHandler.executeWithRetry(async () => {
      // Use template engine for prompt generation, including optional context
      const prompt = this.templateEngine.createDiffSummaryPrompt(diff, options);

      // Estimate tokens for rate limiting (rough estimate)
      const estimatedTokens = Math.ceil((prompt.length + this.maxTokens) / 3);
      
      // Check rate limit before making the API call
      const rateLimitResult = await this.rateLimiter.checkRateLimit('summarization', estimatedTokens);
      if (!rateLimitResult.allowed) {
        const waitTime = rateLimitResult.retryAfterMs || 1000;
        throw new Error(`Rate limit exceeded. Retry after ${waitTime}ms. Remaining tokens: ${rateLimitResult.remainingTokens}`);
      }
      // Debug: log request meta (no sensitive content)
      console.debug('[OpenAIClient] generateSummary request', {
        model: this.model,
        promptChars: prompt.length,
        maxTokens: this.maxTokens,
        estTokens: estimatedTokens,
      });

      let response: any;
      try {
        response = await this.openai.responses.create({
          model: this.model,
          input: [
            {
              role: 'system',
              content: [{ type: 'input_text', text: DIFF_SUMMARY_SYSTEM_PROMPT }],
            },
            {
              role: 'user',
              content: [{ type: 'input_text', text: prompt }],
            },
          ],
          max_output_tokens: this.maxTokens,
        });
        try {
          console.log('[OpenAIClient] responses raw summary response:', safeStringify(response));
        } catch {}
      } catch (e) {
        const err = e as any;
        console.error('[OpenAIClient] responses.create failed (summary)', {
          message: err?.message,
          status: err?.status,
          name: err?.name,
          code: err?.code,
        });
        throw err;
      }

      const usageMeta = response?.usage || undefined;
      const outputItems = Array.isArray(response?.output) ? response.output.length : 0;
      const summary = typeof response?.output_text === 'string'
        ? response.output_text.trim()
        : this.extractFirstTextContent(response)?.trim() ?? '';

      // Debug: log response meta (no content text)
      console.debug('[OpenAIClient] generateSummary response', {
        outputItems,
        contentChars: summary.length,
        usage: usageMeta,
      });

      // If empty, log once; no alternate API fallback
      if (!summary) {
        try {
          console.warn('[OpenAIClient] Empty assistant content from responses API', {
            finishReasons: this.collectFinishReasons(response),
            outputItems,
            maxTokens: this.maxTokens,
          });
        } catch {}
      }

      if (!summary) {
        const compTok = usageMeta?.output_tokens;
        const totTok = usageMeta?.total_tokens;
        const msg = `No summary generated from OpenAI response. finish_reasons=${JSON.stringify(this.collectFinishReasons(response) ?? [])}; output_tokens=${compTok ?? 'n/a'}; total_tokens=${totTok ?? 'n/a'}; maxTokens=${this.maxTokens}`;
        const err = new OpenAIError(msg, 'OUTPUT_TOKEN_LIMIT', false, 400);
        ;(err as any).details = {
          finish_reasons: this.collectFinishReasons(response),
          output_tokens: compTok,
          total_tokens: totTok,
          max_tokens: this.maxTokens,
          operation: 'summarization',
          model: this.model,
          output_items: outputItems,
        };
        // Mark as non-retryable in processor logic using a clear code
        throw err;
      }

      return summary;
    }, 'summarization');
  }

  /**
   * Detect the type of change based on diff and summary
   * Returns a DB-safe enum value: 'feature' | 'fix' (subset of allowed types)
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

      // Debug: log request meta (no sensitive content)
      console.debug('[OpenAIClient] detectChangeType request', {
        model: this.model,
        maxTokens: 10,
      });

      const response = await this.openai.responses.create({
        model: this.model,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: CHANGE_TYPE_SYSTEM_PROMPT }],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: prompt }],
          },
        ],
        max_output_tokens: 10,
      });
      const usageMeta = response?.usage || undefined;
      console.debug('[OpenAIClient] detectChangeType response', {
        outputItems: Array.isArray(response?.output) ? response.output.length : 0,
        usage: usageMeta,
      });

      const raw = typeof response?.output_text === 'string'
        ? response.output_text.trim()
        : this.extractFirstTextContent(response)?.trim() ?? '';
      const normalized = raw?.toLowerCase();
      const category = normalized === 'feature'
        ? 'feature'
        : normalized === 'bug fix' || normalized === 'bugfix'
          ? 'fix'
          : undefined;
      if (!category) {
        throw new Error(`Invalid change type returned by OpenAI: "${raw ?? ''}". Expected one of: Feature, Bug fix`);
      }
      return category;
    }, 'change_detection');
  }

  private extractFirstTextContent(response: any): string | undefined {
    if (!Array.isArray(response?.output)) {
      return undefined;
    }
    for (const item of response.output) {
      const contents = item?.content;
      if (!Array.isArray(contents)) {
        continue;
      }
      for (const part of contents) {
        if (part?.type === 'output_text' && typeof part.text === 'string') {
          return part.text;
        }
      }
    }
    return undefined;
  }

  private collectFinishReasons(response: any): string[] | undefined {
    if (!Array.isArray(response?.output)) {
      return undefined;
    }
    const reasons = response.output
      .map((item: any) => item?.finish_reason)
      .filter((value: any): value is string => typeof value === 'string' && value.length > 0);
    return reasons.length ? Array.from(new Set(reasons)) : undefined;
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
