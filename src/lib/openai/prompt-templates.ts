/**
 * Prompt template system for OpenAI integration
 * Provides configurable templates with variable substitution
 */

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
    template: `You are a changelog assistant. Summarize the following code diff into a 1–2 sentence plain English description of what changed. Be concise and skip minor edits.

{context}

Input:
{diff}`,
    requiredVariables: ['diff'],
    optionalVariables: ['context'],
    defaultValues: {
      context: 'Focus on functional changes that would be relevant to users and developers.'
    }
  },

  change_type_detection: {
    id: 'change_type_detection',
    name: 'Change Type Detection',
    description: 'Detects the type of change (feature, fix, refactor, chore)',
    template: `Analyze the following code diff and summary to determine the type of change.

Diff:
{diff}

Summary:
{summary}

Respond with exactly one of these types:
- feature: New functionality or enhancements
- fix: Bug fixes or error corrections
- refactor: Code restructuring without functional changes
- chore: Maintenance tasks, dependency updates, or tooling changes

Type:`,
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
    customContext?: string
  ): string {
    const variables: TemplateVariables = { diff };
    if (customContext) {
      variables.context = customContext;
    }

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
  customContext?: string
): string {
  return defaultTemplateEngine.createDiffSummaryPrompt(diff, customContext);
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