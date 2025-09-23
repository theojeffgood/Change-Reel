/**
 * Prompt template system for OpenAI integration
 * Provides configurable templates with variable substitution
 */

import {
  CHANGE_TYPE_TEMPLATE,
  DIFF_SUMMARY_TEMPLATE,
} from './prompts';

export interface FileChangeSummary {
  /** Repository-relative path of the file */
  path: string;
  /** Git status string such as added/modified/deleted */
  status?: string;
  /** Lines added in the change */
  additions?: number;
  /** Lines removed in the change */
  deletions?: number;
}

export interface PullRequestSummary {
  title?: string;
  description?: string;
  /** Optional PR number for reference */
  number?: number | string;
  /** Optional link to the PR */
  url?: string;
}

export interface DiffSummaryMetadata {
  fileChanges?: FileChangeSummary[];
  pullRequest?: PullRequestSummary;
  issueReferences?: string[];
}

export interface DiffSummaryPromptOptions {
  customContext?: string;
  metadata?: DiffSummaryMetadata;
}

/**
 * Template variables that can be substituted in prompts
 */
export interface TemplateVariables {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Configuration for a prompt template
 */
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  requiredVariables: string[];
  optionalVariables?: string[];
  defaultValues?: TemplateVariables;
}

/**
 * Available prompt template types
 */
export type PromptTemplateType = 
  | 'diff_summary' 
  | 'change_type_detection' 
  | 'custom';

/**
 * Error thrown when template variables are missing or invalid
 */
export class TemplateValidationError extends Error {
  constructor(
    message: string,
    public templateId: string,
    public missingVariables?: string[]
  ) {
    super(message);
    this.name = 'TemplateValidationError';
  }
}

/**
 * Default prompt templates based on PRD specifications
 */
export const DEFAULT_TEMPLATES: Record<PromptTemplateType, PromptTemplate> = {
  diff_summary: {
    id: 'diff_summary',
    name: 'Diff Summarization',
    description: 'Generates concise summaries of code diffs',
    template: DIFF_SUMMARY_TEMPLATE,
    requiredVariables: ['diff'],
    optionalVariables: ['contextSection'],
    defaultValues: {
      contextSection: '',
    }
  },

  change_type_detection: {
    id: 'change_type_detection',
    name: 'Change Type Detection',
    description: 'Detects the type of change (Feature or Bug fix)',
    template: CHANGE_TYPE_TEMPLATE,
    requiredVariables: ['diff', 'summary'],
    optionalVariables: [],
    defaultValues: {}
  },



  custom: {
    id: 'custom',
    name: 'Custom Template',
    description: 'User-defined custom template',
    template: '{prompt}',
    requiredVariables: ['prompt'],
    optionalVariables: [],
    defaultValues: {}
  }
};

/**
 * Prompt template engine for variable substitution and validation
 */
export class PromptTemplateEngine {
  private templates: Map<string, PromptTemplate>;

  constructor(customTemplates?: PromptTemplate[]) {
    this.templates = new Map();
    
    // Load default templates
    Object.values(DEFAULT_TEMPLATES).forEach(template => {
      this.templates.set(template.id, template);
    });

    // Add custom templates if provided
    if (customTemplates) {
      customTemplates.forEach(template => {
        this.templates.set(template.id, template);
      });
    }
  }

  /**
   * Register a new template or update an existing one
   */
  registerTemplate(template: PromptTemplate): void {
    this.validateTemplate(template);
    this.templates.set(template.id, template);
  }

  /**
   * Get a template by ID
   */
  getTemplate(templateId: string): PromptTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get all available templates
   */
  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Render a template with provided variables
   */
  renderTemplate(
    templateId: string, 
    variables: TemplateVariables
  ): string {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new TemplateValidationError(
        `Template not found: ${templateId}`,
        templateId
      );
    }

    // Merge with default values
    const mergedVariables = {
      ...template.defaultValues,
      ...variables
    };

    // Validate required variables
    this.validateVariables(template, mergedVariables);

    // Perform variable substitution
    return this.substituteVariables(template.template, mergedVariables);
  }

  /**
   * Create a prompt for diff summarization (convenience method)
   */
  createDiffSummaryPrompt(
    diff: string,
    options?: DiffSummaryPromptOptions
  ): string {
    const contextBlock = this.buildContext(options);
    const variables: TemplateVariables = {
      diff,
      contextSection: contextBlock ? `Context:\n${contextBlock}\n\n` : '',
    };

    return this.renderTemplate('diff_summary', variables);
  }

  /**
   * Create a prompt for change type detection (convenience method)
   */
  createChangeTypePrompt(diff: string, summary: string): string {
    return this.renderTemplate('change_type_detection', { diff, summary });
  }

  /**
   * Create a custom prompt with variable substitution
   */
  createCustomPrompt(
    template: string, 
    variables: TemplateVariables
  ): string {
    const customTemplate: PromptTemplate = {
      id: 'temp_custom',
      name: 'Temporary Custom',
      description: 'Temporary custom template',
      template,
      requiredVariables: this.extractRequiredVariables(template),
      defaultValues: {}
    };

    this.validateVariables(customTemplate, variables);
    return this.substituteVariables(template, variables);
  }

  /**
   * Validate template structure
   */
  private validateTemplate(template: PromptTemplate): void {
    if (!template.id || !template.template) {
      throw new TemplateValidationError(
        'Template must have id and template properties',
        template.id || 'unknown'
      );
    }

    if (!Array.isArray(template.requiredVariables)) {
      throw new TemplateValidationError(
        'Template must have requiredVariables array',
        template.id
      );
    }
  }

  /**
   * Validate that all required variables are provided
   */
  private validateVariables(
    template: PromptTemplate, 
    variables: TemplateVariables
  ): void {
    const missingVariables = template.requiredVariables.filter(
      varName => variables[varName] === undefined || variables[varName] === null
    );

    if (missingVariables.length > 0) {
      throw new TemplateValidationError(
        `Missing required variables: ${missingVariables.join(', ')}`,
        template.id,
        missingVariables
      );
    }
  }

  /**
   * Substitute variables in template string
   */
  private substituteVariables(
    template: string, 
    variables: TemplateVariables
  ): string {
    let result = template;

    // Replace variables in {variable} format
    Object.entries(variables).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        result = result.replace(regex, String(value));
      }
    });

    // Check for unreplaced variables (excluding code blocks)
    const unreplacedVars = result.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g);
    if (unreplacedVars && unreplacedVars.length > 0) {
      console.warn('Unreplaced template variables found:', unreplacedVars);
    }

    return result;
  }

  /**
   * Extract required variables from template string
   */
  private extractRequiredVariables(template: string): string[] {
    const matches = template.match(/\{([^}]+)\}/g);
    if (!matches) return [];

    return matches
      .map(match => match.slice(1, -1)) // Remove { and }
      .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
  }

  private buildContext(options?: DiffSummaryPromptOptions): string {
    const lines: string[] = [];

    const baseContext = options?.customContext?.trim();
    if (baseContext) {
      lines.push(baseContext);
    }

    const metadata = options?.metadata;
    if (!metadata) {
      return lines.join('\n');
    }

    const fileChanges = this.formatFileChanges(metadata.fileChanges);
    if (fileChanges.length) {
      if (lines.length) {
        lines.push('');
      }
      lines.push('File Changes:');
      fileChanges.forEach(change => {
        lines.push(`- ${change}`);
      });
    }

    const pullRequest = this.formatPullRequest(metadata.pullRequest);
    if (pullRequest.length) {
      if (lines.length) {
        lines.push('');
      }
      lines.push('Pull Request:');
      pullRequest.forEach(line => lines.push(line));
    }

    const issues = this.formatIssueReferences(metadata.issueReferences);
    if (issues.length) {
      if (lines.length) {
        lines.push('');
      }
      lines.push('Issue References:');
      issues.forEach(ref => {
        lines.push(`- ${ref}`);
      });
    }

    return lines.join('\n');
  }

  private formatFileChanges(changes?: FileChangeSummary[]): string[] {
    if (!changes?.length) {
      return [];
    }

    return changes
      .filter(change => Boolean(change?.path))
      .map(change => {
        const parts: string[] = [change.path];

        const descriptors: string[] = [];
        if (change.status) {
          descriptors.push(change.status);
        }

        const hasAdditions = typeof change.additions === 'number';
        const hasDeletions = typeof change.deletions === 'number';
        if (hasAdditions || hasDeletions) {
          const additions = hasAdditions ? change.additions : 0;
          const deletions = hasDeletions ? change.deletions : 0;
          descriptors.push(`+${additions}/-${deletions}`);
        }

        if (descriptors.length) {
          parts.push(`(${descriptors.join(', ')})`);
        }

        return parts.join(' ');
      });
  }

  private formatPullRequest(pr?: PullRequestSummary): string[] {
    if (!pr) {
      return [];
    }

    const lines: string[] = [];
    if (pr.number !== undefined && pr.number !== null && `${pr.number}`.trim().length > 0) {
      lines.push(`- Number: ${pr.number}`);
    }
    if (pr.title?.trim()) {
      lines.push(`- Title: ${pr.title.trim()}`);
    }
    if (pr.url?.trim()) {
      lines.push(`- URL: ${pr.url.trim()}`);
    }
    if (pr.description?.trim()) {
      lines.push('- Description:');
      lines.push(this.indentBlock(pr.description.trim(), '  '));
    }

    return lines;
  }

  private formatIssueReferences(references?: string[]): string[] {
    if (!references?.length) {
      return [];
    }

    return references
      .map(ref => ref?.trim())
      .filter((ref): ref is string => Boolean(ref && ref.length > 0));
  }

  private indentBlock(text: string, indent: string): string {
    return text
      .split(/\r?\n/)
      .map(line => `${indent}${line}`)
      .join('\n');
  }
}

/**
 * Default template engine instance
 */
export const defaultTemplateEngine = new PromptTemplateEngine();

/**
 * Convenience functions for common operations
 */

/**
 * Create a diff summary prompt using the default template
 */
export function createDiffSummaryPrompt(
  diff: string,
  options?: DiffSummaryPromptOptions
): string {
  return defaultTemplateEngine.createDiffSummaryPrompt(diff, options);
}

/**
 * Create a change type detection prompt using the default template
 */
export function createChangeTypePrompt(diff: string, summary: string): string {
  return defaultTemplateEngine.createChangeTypePrompt(diff, summary);
}

/**
 * Create a custom prompt with variable substitution
 */
export function createCustomPrompt(
  template: string, 
  variables: TemplateVariables
): string {
  return defaultTemplateEngine.createCustomPrompt(template, variables);
}

/**
 * Register a new global template
 */
export function registerGlobalTemplate(template: PromptTemplate): void {
  defaultTemplateEngine.registerTemplate(template);
}

/**
 * Get all available global templates
 */
export function getAvailableTemplates(): PromptTemplate[] {
  return defaultTemplateEngine.getAllTemplates();
} 
