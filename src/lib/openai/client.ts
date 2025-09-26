import OpenAI from 'openai';
import type { ResponseCreateParams } from 'openai/resources/responses/responses';
import { PromptTemplateEngine, DiffSummaryPromptOptions } from './prompt-templates';
import { OpenAIRateLimiter, defaultRateLimiter } from './rate-limiter';
import { OpenAIErrorHandler, defaultErrorHandler, OpenAIError } from './error-handler';
import { DIFF_SUMMARY_TEMPLATE } from './prompts';

const DIFF_SUMMARY_SCHEMA_NAME = 'DiffSummary';
const DIFF_SUMMARY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'One short paragraph summarizing the diff for a non-technical audience.',
      minLength: 1,
    },
    change_type: {
      type: 'string',
      description: 'Categorization of the change.',
      enum: ['feature', 'fix'],
    },
  },
  required: ['summary', 'change_type'],
  additionalProperties: false,
} as const;

type ResponseCreateParamsWithSchema = ResponseCreateParams & {
  text?: {
    format?: {
      type: 'json_schema';
      name: string;
      schema: typeof DIFF_SUMMARY_RESPONSE_SCHEMA;
      strict?: boolean;
    };
  };
};

/**
 * Interface for OpenAI client to enable dependency injection and testing
 */
export type ChangeTypeCategory = 'feature' | 'fix';

export interface GenerateSummaryResult {
  summary: string;
  changeType: ChangeTypeCategory;
}

export interface IOpenAIClient {
  // customContext is optional additional guidance appended to the prompt; NOT a template
  generateSummary(diff: string, options?: DiffSummaryPromptOptions): Promise<GenerateSummaryResult>;
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

  private static readonly DEFAULT_CHANGE_TYPE: ChangeTypeCategory = 'feature';

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
  async generateSummary(diff: string, options?: DiffSummaryPromptOptions): Promise<GenerateSummaryResult> {
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
        const requestPayload: ResponseCreateParamsWithSchema = {
          model: this.model,
          instructions: DIFF_SUMMARY_TEMPLATE,
          input: prompt,
          max_output_tokens: this.maxTokens,
          text: {
            format: {
              type: 'json_schema',
              name: DIFF_SUMMARY_SCHEMA_NAME,
              schema: DIFF_SUMMARY_RESPONSE_SCHEMA,
              strict: true,
            },
          },
          store: true,
        };
        response = await this.openai.responses.create(requestPayload);
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
      const structuredPayload = this.extractJsonSchemaPayload(response);
      const fallbackText = typeof response?.output_text === 'string'
        ? response.output_text
        : this.extractFirstTextContent(response);
      const parsed = this.parseStructuredSummary(structuredPayload ?? fallbackText ?? '');
      const summary = parsed.summary.trim();

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

      const changeType = this.normalizeChangeType(parsed.changeType);
      if (!changeType) {
        console.warn('[OpenAIClient] Invalid or missing change type from summary response, defaulting to "feature"', {
          received: parsed.changeType,
        });
      }

      return {
        summary,
        changeType: changeType ?? OpenAIClient.DEFAULT_CHANGE_TYPE,
      };
    }, 'summarization');
  }

  private extractJsonSchemaPayload(response: any): Record<string, unknown> | undefined {
    if (!Array.isArray(response?.output)) {
      return undefined;
    }
    for (const item of response.output) {
      const contents = item?.content;
      if (!Array.isArray(contents)) {
        continue;
      }
      for (const part of contents) {
        if (part?.type === 'json_schema') {
          const payload = part?.json_schema?.output;
          if (payload && typeof payload === 'object') {
            return payload as Record<string, unknown>;
          }
        }
      }
    }
    return undefined;
  }

  private parseStructuredSummary(output: unknown): { summary: string; changeType?: string } {
    if (!output) {
      return { summary: '' };
    }

    if (typeof output === 'object') {
      const candidate = output as Record<string, unknown>;
      const summaryField = candidate.summary;
      const changeTypeField = candidate.change_type ?? candidate.changeType;

      if (typeof summaryField === 'string' && summaryField.trim().length > 0) {
        return {
          summary: summaryField.trim(),
          changeType: typeof changeTypeField === 'string' ? changeTypeField : undefined,
        };
      }

      if (typeof candidate.output === 'string') {
        return this.parseStructuredSummary(candidate.output);
      }
    }

    if (typeof output !== 'string') {
      return { summary: '' };
    }

    const trimmed = output.trim();
    if (!trimmed) {
      return { summary: '' };
    }

    const parsed = this.tryParseJsonObject(trimmed);
    if (parsed && typeof parsed === 'object') {
      const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
      const changeType = (parsed.change_type ?? parsed.changeType) as string | undefined;
      if (summary) {
        return { summary, changeType };
      }
    }

    // Fallback: treat the whole output as summary text
    return { summary: trimmed };
  }

  private tryParseJsonObject(raw: string): any | undefined {
    try {
      return JSON.parse(raw);
    } catch {}

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const slice = raw.slice(start, end + 1);
      try {
        return JSON.parse(slice);
      } catch {}
    }

    return undefined;
  }

  private normalizeChangeType(raw?: string): ChangeTypeCategory | undefined {
    if (!raw) {
      return undefined;
    }

    const normalized = raw
      .toLowerCase()
      .replace(/[^a-z]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    switch (normalized) {
      case 'feature':
        return 'feature';
      case 'fix':
        return 'fix';
      default:
        return undefined;
    }
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
        if (part?.type === 'json_schema') {
          const payload = part?.json_schema?.output;
          if (payload && typeof payload === 'object') {
            const summary = (payload as any).summary;
            if (typeof summary === 'string') {
              return summary;
            }
            const changeType = (payload as any).change_type ?? (payload as any).changeType;
            if (typeof changeType === 'string') {
              return changeType;
            }
          }
          continue;
        }
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
