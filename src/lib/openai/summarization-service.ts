/**
 * Summarization service for processing Git diffs and generating AI-powered summaries
 * Integrates OpenAI client with prompt templates following dependency injection pattern
 */

import { IOpenAIClient } from './client';
import { PromptTemplateEngine } from './prompt-templates';

/**
 * Configuration for diff processing
 */
export interface DiffProcessingConfig {
  maxDiffLength?: number;
  excludePatterns?: string[];
  includeMetadata?: boolean;
  customContext?: string;
}

/**
 * Result of summarization processing
 */
export interface SummaryResult {
  summary: string;
  changeType: 'feature' | 'fix' | 'refactor' | 'chore';
  confidence: number;
  metadata: {
    diffLength: number;
    processingTimeMs: number;
    templateUsed: string;
    tokensUsed?: number;
  };
}

/**
 * Interface for summarization service to enable dependency injection
 */
export interface ISummarizationService {
  processDiff(diff: string, config?: DiffProcessingConfig): Promise<SummaryResult>;
  processMultipleDiffs(diffs: string[], config?: DiffProcessingConfig): Promise<SummaryResult[]>;
  validateDiff(diff: string): boolean;
  preProcessDiff(diff: string, config?: DiffProcessingConfig): string;
}

/**
 * Diff summarization service implementation
 */
export class SummarizationService implements ISummarizationService {
  private openaiClient: IOpenAIClient;
  private templateEngine: PromptTemplateEngine;
  private defaultConfig: Required<DiffProcessingConfig>;

  constructor(
    openaiClient: IOpenAIClient,
    templateEngine?: PromptTemplateEngine,
    defaultConfig?: Partial<DiffProcessingConfig>
  ) {
    this.openaiClient = openaiClient;
    this.templateEngine = templateEngine || new PromptTemplateEngine();
    this.defaultConfig = {
      maxDiffLength: 8000, // Stay within token limits
      excludePatterns: [
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        '.lock',
        'dist/',
        'build/',
        'node_modules/',
        '.git/',
        'coverage/',
        '__pycache__/',
        '.DS_Store',
        'Thumbs.db'
      ],
      includeMetadata: true,
      customContext: 'Focus on functional changes that would be relevant to users and developers.',
      ...defaultConfig
    };
  }

  /**
   * Process a single diff and generate summary with change type detection
   */
  async processDiff(diff: string, config?: DiffProcessingConfig): Promise<SummaryResult> {
    const startTime = Date.now();
    const mergedConfig = { ...this.defaultConfig, ...config };

    // Validate and preprocess the diff
    if (!this.validateDiff(diff)) {
      throw new Error('Invalid diff content provided');
    }

    const processedDiff = this.preProcessDiff(diff, mergedConfig);
    
    try {
      // Generate summary using OpenAI client
      const summary = await this.openaiClient.generateSummary(
        processedDiff,
        mergedConfig.customContext
      );

      // Detect change type
      const changeType = await this.openaiClient.detectChangeType(processedDiff, summary);

      // Calculate confidence based on diff characteristics
      const confidence = this.calculateConfidence(processedDiff, summary);

      const processingTime = Date.now() - startTime;

      return {
        summary: summary.trim(),
        changeType,
        confidence,
        metadata: {
          diffLength: processedDiff.length,
          processingTimeMs: processingTime,
          templateUsed: 'diff_summary',
          // tokensUsed would be calculated from actual API response in production
        }
      };
    } catch (error) {
      throw new Error(`Failed to process diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process multiple diffs in batch (sequential processing to avoid rate limits)
   */
  async processMultipleDiffs(
    diffs: string[], 
    config?: DiffProcessingConfig
  ): Promise<SummaryResult[]> {
    if (!diffs.length) {
      return [];
    }

    const results: SummaryResult[] = [];
    
    for (const diff of diffs) {
      // Process diff without fallback - let errors propagate
      const result = await this.processDiff(diff, config);
      results.push(result);
      
      // Small delay to respect rate limits
      await this.delay(100);
    }

    return results;
  }

  /**
   * Validate that diff content is suitable for processing
   */
  validateDiff(diff: string): boolean {
    if (!diff || typeof diff !== 'string') {
      return false;
    }

    const trimmedDiff = diff.trim();
    
    // Check for minimum content
    if (trimmedDiff.length < 10) {
      return false;
    }

    // Check for basic diff markers
    if (!trimmedDiff.includes('@@') && 
        !trimmedDiff.includes('+++') && 
        !trimmedDiff.includes('---') &&
        !trimmedDiff.includes('diff --git')) {
      return false;
    }

    return true;
  }

  /**
   * Preprocess diff content before sending to AI
   */
  preProcessDiff(diff: string, config?: DiffProcessingConfig): string {
    const mergedConfig = { ...this.defaultConfig, ...config };
    let processedDiff = diff.trim();

    // Remove or minimize noise files based on exclude patterns
    processedDiff = this.filterNoiseFiles(processedDiff, mergedConfig.excludePatterns);

    // Truncate if too long to fit within token limits
    if (processedDiff.length > mergedConfig.maxDiffLength) {
      processedDiff = this.truncateDiff(processedDiff, mergedConfig.maxDiffLength);
    }

    return processedDiff;
  }

  /**
   * Get template engine instance for custom operations
   */
  getTemplateEngine(): PromptTemplateEngine {
    return this.templateEngine;
  }

  /**
   * Update default configuration
   */
  updateConfig(newConfig: Partial<DiffProcessingConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...newConfig };
  }

  /**
   * Filter out noise files and content from diff
   */
  private filterNoiseFiles(diff: string, excludePatterns: string[]): string {
    const lines = diff.split('\n');
    const filteredLines: string[] = [];
    let skipUntilNextFile = false;

    for (const line of lines) {
      // Check if this is a file header
      if (line.startsWith('diff --git') || line.startsWith('+++') || line.startsWith('---')) {
        skipUntilNextFile = excludePatterns.some(pattern => 
          line.includes(pattern) || new RegExp(pattern.replace('*', '.*')).test(line)
        );
      }

      if (!skipUntilNextFile) {
        filteredLines.push(line);
      }

      // Reset skip flag for next file
      if (line.startsWith('diff --git')) {
        skipUntilNextFile = excludePatterns.some(pattern => 
          line.includes(pattern) || new RegExp(pattern.replace('*', '.*')).test(line)
        );
      }
    }

    return filteredLines.join('\n');
  }

  /**
   * Intelligently truncate diff while preserving important information
   */
  private truncateDiff(diff: string, maxLength: number): string {
    if (diff.length <= maxLength) {
      return diff;
    }

    const lines = diff.split('\n');
    const importantLines: string[] = [];
    const regularLines: string[] = [];

    // Separate important lines (headers, context) from content
    for (const line of lines) {
      if (line.startsWith('diff --git') || 
          line.startsWith('@@') || 
          line.startsWith('+++') || 
          line.startsWith('---') ||
          line.startsWith('index ')) {
        importantLines.push(line);
      } else {
        regularLines.push(line);
      }
    }

    // Start with important lines
    let result = importantLines.join('\n');
    
    // Add regular lines until we reach the limit
    for (const line of regularLines) {
      if ((result + '\n' + line).length > maxLength) {
        result += '\n... (diff truncated for length)';
        break;
      }
      result += '\n' + line;
    }

    return result;
  }

  /**
   * Calculate confidence score based on diff characteristics
   */
  private calculateConfidence(diff: string, summary: string): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence for longer, more detailed diffs
    if (diff.length > 500) confidence += 0.2;
    if (diff.length > 2000) confidence += 0.1;

    // Higher confidence for diffs with clear structure
    if (diff.includes('@@') && diff.includes('+++') && diff.includes('---')) {
      confidence += 0.2;
    }

    // Lower confidence for very short or very long summaries
    if (summary.length < 20 || summary.length > 200) {
      confidence -= 0.1;
    }

    // Ensure confidence is between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Simple delay utility for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create summarization service with default dependencies
 */
export function createSummarizationService(
  openaiClient: IOpenAIClient,
  config?: Partial<DiffProcessingConfig>
): SummarizationService {
  return new SummarizationService(openaiClient, undefined, config);
}

/**
 * Factory function with custom template engine
 */
export function createSummarizationServiceWithTemplates(
  openaiClient: IOpenAIClient,
  templateEngine: PromptTemplateEngine,
  config?: Partial<DiffProcessingConfig>
): SummarizationService {
  return new SummarizationService(openaiClient, templateEngine, config);
} 