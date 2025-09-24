import {
  PromptTemplate,
  PromptTemplateEngine,
  TemplateValidationError,
  DEFAULT_TEMPLATES,
  defaultTemplateEngine,
  createDiffSummaryPrompt,
  createCustomPrompt,
  registerGlobalTemplate,
  getAvailableTemplates
} from '@/lib/openai/prompt-templates';

describe('PromptTemplateEngine', () => {
  let engine: PromptTemplateEngine;

  beforeEach(() => {
    engine = new PromptTemplateEngine();
  });

  describe('constructor', () => {
    it('should initialize with default templates', () => {
      const templates = engine.getAllTemplates();
      expect(templates).toHaveLength(2);
      
      const templateIds = templates.map(t => t.id);
      expect(templateIds).toContain('diff_summary');
      expect(templateIds).toContain('custom');
    });

    it('should initialize with custom templates', () => {
      const customTemplate: PromptTemplate = {
        id: 'test_template',
        name: 'Test Template',
        description: 'A test template',
        template: 'Hello {name}!',
        requiredVariables: ['name']
      };

      const customEngine = new PromptTemplateEngine([customTemplate]);
      const templates = customEngine.getAllTemplates();
      
      expect(templates).toHaveLength(3); // 2 default + 1 custom
      expect(customEngine.getTemplate('test_template')).toEqual(customTemplate);
    });
  });

  describe('registerTemplate', () => {
    it('should register a new template', () => {
      const template: PromptTemplate = {
        id: 'new_template',
        name: 'New Template',
        description: 'A new template',
        template: 'Content with {variable}',
        requiredVariables: ['variable']
      };

      engine.registerTemplate(template);
      
      expect(engine.getTemplate('new_template')).toEqual(template);
    });

    it('should update an existing template', () => {
      const original = engine.getTemplate('diff_summary')!;
      const updated: PromptTemplate = {
        ...original,
        description: 'Updated description'
      };

      engine.registerTemplate(updated);
      
      expect(engine.getTemplate('diff_summary')?.description).toBe('Updated description');
    });

    it('should validate template structure', () => {
      const invalidTemplate = {
        id: '',
        name: '',
        description: '',
        template: '',
        requiredVariables: []
      } as PromptTemplate;

      expect(() => engine.registerTemplate(invalidTemplate)).toThrow(TemplateValidationError);
    });
  });

  describe('renderTemplate', () => {
    it('should render template with required variables', () => {
      const result = engine.renderTemplate('diff_summary', {
        diff: 'Added new function'
      });

      expect(result).toContain('Added new function');
      expect(result).not.toContain('Context:');
    });

    it('should render template with optional variables', () => {
      const result = engine.renderTemplate('diff_summary', {
        diff: 'Added new function',
        contextSection: 'Context:\nCustom context for the diff\n\n'
      });

      expect(result).toContain('Added new function');
      expect(result).toContain('Context:\nCustom context for the diff');
    });

    it('should merge default values', () => {
      const template: PromptTemplate = {
        id: 'test_merge',
        name: 'Test Merge',
        description: 'Test default value merging',
        template: 'Hello {name}, you are {age} years old',
        requiredVariables: ['name'],
        defaultValues: {
          age: 25
        }
      };

      engine.registerTemplate(template);
      const result = engine.renderTemplate('test_merge', { name: 'John' });

      expect(result).toBe('Hello John, you are 25 years old');
    });

    it('should override default values with provided values', () => {
      const template: PromptTemplate = {
        id: 'test_override',
        name: 'Test Override',
        description: 'Test default value override',
        template: 'Hello {name}, you are {age} years old',
        requiredVariables: ['name'],
        defaultValues: {
          age: 25
        }
      };

      engine.registerTemplate(template);
      const result = engine.renderTemplate('test_override', { 
        name: 'John', 
        age: 30 
      });

      expect(result).toBe('Hello John, you are 30 years old');
    });

    it('should throw error for missing template', () => {
      expect(() => {
        engine.renderTemplate('nonexistent', {});
      }).toThrow(TemplateValidationError);
    });

    it('should throw error for missing required variables', () => {
      expect(() => {
        engine.renderTemplate('diff_summary', {});
      }).toThrow(TemplateValidationError);
    });

    it('should handle multiple instances of same variable', () => {
      const template: PromptTemplate = {
        id: 'test_multiple',
        name: 'Test Multiple',
        description: 'Test multiple variable instances',
        template: '{greeting} {name}, {greeting} again {name}!',
        requiredVariables: ['greeting', 'name']
      };

      engine.registerTemplate(template);
      const result = engine.renderTemplate('test_multiple', {
        greeting: 'Hello',
        name: 'World'
      });

      expect(result).toBe('Hello World, Hello again World!');
    });

    it('should warn about unreplaced variables', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const template: PromptTemplate = {
        id: 'test_unreplaced',
        name: 'Test Unreplaced',
        description: 'Test unreplaced variables',
        template: 'Hello {name}, you have {unset} messages',
        requiredVariables: ['name']
      };

      engine.registerTemplate(template);
      const result = engine.renderTemplate('test_unreplaced', { name: 'John' });

      expect(result).toBe('Hello John, you have {unset} messages');
      expect(consoleSpy).toHaveBeenCalledWith('Unreplaced template variables found:', ['{unset}']);
      
      consoleSpy.mockRestore();
    });
  });

  describe('createDiffSummaryPrompt', () => {
    it('should create diff summary prompt with default context', () => {
      const result = engine.createDiffSummaryPrompt('Added login function');

      expect(result).toContain('Added login function');
      expect(result).toContain('changelog assistant');
      expect(result).not.toContain('Context:');
    });

    it('should create diff summary prompt with custom context', () => {
      const result = engine.createDiffSummaryPrompt(
        'Added login function',
        { customContext: 'This is for the authentication module' }
      );

      expect(result).toContain('Added login function');
      expect(result).toContain('This is for the authentication module');
      expect(result).toContain('Context:');
    });
  });

  describe('createCustomPrompt', () => {
    it('should create custom prompt with variable substitution', () => {
      const result = engine.createCustomPrompt(
        'Process this {type} with {method}',
        { type: 'data', method: 'algorithm' }
      );

      expect(result).toBe('Process this data with algorithm');
    });

    it('should validate required variables in custom prompt', () => {
      expect(() => {
        engine.createCustomPrompt(
          'Process this {type} with {method}',
          { type: 'data' } // missing 'method'
        );
      }).toThrow(TemplateValidationError);
    });

    it('should extract required variables from template', () => {
      // This tests the private extractRequiredVariables method indirectly
      expect(() => {
        engine.createCustomPrompt(
          'Hello {name}, you are {age} years old',
          { name: 'John' } // missing 'age'
        );
      }).toThrow(TemplateValidationError);
    });
  });
});

describe('TemplateValidationError', () => {
  it('should create error with template ID and missing variables', () => {
    const error = new TemplateValidationError(
      'Test error',
      'test_template',
      ['var1', 'var2']
    );

    expect(error.name).toBe('TemplateValidationError');
    expect(error.message).toBe('Test error');
    expect(error.templateId).toBe('test_template');
    expect(error.missingVariables).toEqual(['var1', 'var2']);
  });
});

describe('DEFAULT_TEMPLATES', () => {
  it('should have all required template types', () => {
    expect(DEFAULT_TEMPLATES).toHaveProperty('diff_summary');
    expect(DEFAULT_TEMPLATES).toHaveProperty('custom');
  });

  it('should have valid template structure', () => {
    Object.values(DEFAULT_TEMPLATES).forEach(template => {
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('template');
      expect(template).toHaveProperty('requiredVariables');
      expect(Array.isArray(template.requiredVariables)).toBe(true);
    });
  });

  describe('diff_summary template', () => {
    it('should require diff variable', () => {
      const template = DEFAULT_TEMPLATES.diff_summary;
      expect(template.requiredVariables).toContain('diff');
    });

    it('should have default context', () => {
      const template = DEFAULT_TEMPLATES.diff_summary;
      expect(template.defaultValues?.contextSection).toBe('');
    });
  });


});

describe('convenience functions', () => {
  const mockDiff = 'Added new feature';
  const mockSummary = 'Implemented user authentication';

  describe('createDiffSummaryPrompt', () => {
    it('should create diff summary prompt', () => {
      const result = createDiffSummaryPrompt(mockDiff);
      
      expect(result).toContain(mockDiff);
      expect(result).toContain('changelog assistant');
      expect(result).not.toContain('Context:');
    });

    it('should create diff summary prompt with custom context', () => {
      const customContext = 'Custom context for testing';
      const result = createDiffSummaryPrompt(mockDiff, { customContext });
      
      expect(result).toContain(mockDiff);
      expect(result).toContain(customContext);
      expect(result).toContain('Context:');
    });

    it('should include metadata when provided', () => {
      const result = createDiffSummaryPrompt(mockDiff, {
        metadata: {
          fileChanges: [
            { path: 'src/app.ts', status: 'modified', additions: 5, deletions: 2 },
          ],
          pullRequest: { title: 'Add new feature', description: 'Implements feature XYZ' },
          issueReferences: ['#123', 'PROJ-456'],
        },
      });

      expect(result).toContain('File Changes:');
      expect(result).toContain('src/app.ts');
      expect(result).toContain('Pull Request:');
      expect(result).toContain('Issue References:');
      expect(result).toContain('#123');
      expect(result).toContain('Context:');
    });
  });

  describe('createCustomPrompt', () => {
    it('should create custom prompt', () => {
      const template = 'Process {item} with {tool}';
      const variables = { item: 'data', tool: 'parser' };
      const result = createCustomPrompt(template, variables);
      
      expect(result).toBe('Process data with parser');
    });
  });

  describe('registerGlobalTemplate', () => {
    it('should register template globally', () => {
      const template: PromptTemplate = {
        id: 'global_test',
        name: 'Global Test',
        description: 'Global test template',
        template: 'Test {value}',
        requiredVariables: ['value']
      };

      registerGlobalTemplate(template);
      
      const templates = getAvailableTemplates();
      const registeredTemplate = templates.find(t => t.id === 'global_test');
      expect(registeredTemplate).toEqual(template);
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return all global templates', () => {
      const templates = getAvailableTemplates();
      
      expect(templates.length).toBeGreaterThanOrEqual(3);
      expect(templates.some(t => t.id === 'diff_summary')).toBe(true);
      expect(templates.some(t => t.id === 'custom')).toBe(true);
    });
  });
}); 
