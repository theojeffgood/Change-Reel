/**
 * Test suite for SummarizationService
 * Tests diff processing, summary generation, and error handling
 */

import {
  SummarizationService,
  ISummarizationService,
  DiffProcessingConfig,
  SummaryResult,
  createSummarizationService,
  createSummarizationServiceWithTemplates,
} from '../../../lib/openai/summarization-service';
import { IOpenAIClient } from '../../../lib/openai/client';
import { PromptTemplateEngine } from '../../../lib/openai/prompt-templates';

// Mock implementations
const mockOpenAIClient: jest.Mocked<IOpenAIClient> = {
  generateSummary: jest.fn(),
  detectChangeType: jest.fn(),
};

const mockTemplateEngine = {
  renderTemplate: jest.fn(),
  createDiffSummaryPrompt: jest.fn(),
  createChangeTypePrompt: jest.fn(),
} as unknown as jest.Mocked<PromptTemplateEngine>;

describe('SummarizationService', () => {
  let service: ISummarizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SummarizationService(mockOpenAIClient, mockTemplateEngine);
  });

  describe('constructor', () => {
    it('should create service with default template engine when not provided', () => {
      const serviceWithDefaults = new SummarizationService(mockOpenAIClient);
      expect(serviceWithDefaults).toBeInstanceOf(SummarizationService);
    });

    it('should use provided custom configuration', () => {
      const customConfig: Partial<DiffProcessingConfig> = {
        maxDiffLength: 5000,
        customContext: 'Custom context for testing'
      };

      const customService = new SummarizationService(
        mockOpenAIClient,
        mockTemplateEngine,
        customConfig
      );

      expect(customService).toBeInstanceOf(SummarizationService);
    });
  });

  describe('validateDiff', () => {
    it('should validate properly formatted diffs', () => {
      const validDiff = `diff --git a/file.js b/file.js
index 1234567..abcdefg 100644
--- a/file.js
+++ b/file.js
@@ -1,3 +1,4 @@
 function test() {
+  console.log('new line');
   return true;
 }`;

      expect(service.validateDiff(validDiff)).toBe(true);
    });

    it('should reject empty or null diffs', () => {
      expect(service.validateDiff('')).toBe(false);
      expect(service.validateDiff('   ')).toBe(false);
      expect(service.validateDiff(null as any)).toBe(false);
      expect(service.validateDiff(undefined as any)).toBe(false);
    });

    it('should reject diffs without proper markers', () => {
      expect(service.validateDiff('just some text')).toBe(false);
      expect(service.validateDiff('no diff markers here')).toBe(false);
    });

    it('should accept diffs with minimal valid content', () => {
      expect(service.validateDiff('@@ -1,1 +1,2 @@\n+new line')).toBe(true);
      expect(service.validateDiff('--- a/file\n+++ b/file')).toBe(true);
    });
  });

  describe('preProcessDiff', () => {
    it('should trim whitespace from diffs', () => {
      const diff = '  \n  diff --git a/file.js b/file.js  \n  ';
      const result = service.preProcessDiff(diff);
      expect(result).not.toMatch(/^\s+|\s+$/);
    });

    it('should filter out noise files', () => {
      const diffWithNoise = `diff --git a/package-lock.json b/package-lock.json
index 1234567..abcdefg 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,3 +1,4 @@
 {
+  "new": "dependency"
 }
diff --git a/src/component.js b/src/component.js
index 7890123..fedcba9 100644
--- a/src/component.js
+++ b/src/component.js
@@ -1,2 +1,3 @@
 function component() {
+  console.log('actual change');
 }`;

      const result = service.preProcessDiff(diffWithNoise);
      expect(result).not.toContain('package-lock.json');
      expect(result).toContain('src/component.js');
      expect(result).toContain('actual change');
    });

    it('should truncate long diffs intelligently', () => {
      const longDiff = 'diff --git a/file.js b/file.js\n' + 'x'.repeat(10000);
      const config: DiffProcessingConfig = { maxDiffLength: 500 };
      
      const result = service.preProcessDiff(longDiff, config);
      
      expect(result.length).toBeLessThanOrEqual(500);
      expect(result).toContain('diff --git a/file.js b/file.js');
      expect(result).toContain('(diff truncated for length)');
    });
  });

  describe('processDiff', () => {
    const validDiff = `diff --git a/src/component.js b/src/component.js
index 1234567..abcdefg 100644
--- a/src/component.js
+++ b/src/component.js
@@ -1,3 +1,4 @@
 function component() {
+  console.log('added logging');
   return <div>Hello</div>;
 }`;

    beforeEach(() => {
      mockOpenAIClient.generateSummary.mockResolvedValue('Added logging to component function');
      mockOpenAIClient.detectChangeType.mockResolvedValue('feature');
    });

    it('should process valid diff and return summary result', async () => {
      const result = await service.processDiff(validDiff);

      expect(result).toEqual({
        summary: 'Added logging to component function',
        changeType: 'feature',
        confidence: expect.any(Number),
        metadata: {
          diffLength: expect.any(Number),
          processingTimeMs: expect.any(Number),
          templateUsed: 'diff_summary'
        }
      });

      expect(mockOpenAIClient.generateSummary).toHaveBeenCalledWith(
        expect.stringContaining('src/component.js'),
        'Focus on functional changes that would be relevant to users and developers.'
      );
      expect(mockOpenAIClient.detectChangeType).toHaveBeenCalledWith(
        expect.stringContaining('src/component.js'),
        'Added logging to component function'
      );
    });

    it('should use custom context when provided', async () => {
      const customConfig: DiffProcessingConfig = {
        customContext: 'Custom analysis context'
      };

      await service.processDiff(validDiff, customConfig);

      expect(mockOpenAIClient.generateSummary).toHaveBeenCalledWith(
        expect.any(String),
        'Custom analysis context'
      );
    });

    it('should handle OpenAI API errors gracefully', async () => {
      mockOpenAIClient.generateSummary.mockRejectedValue(new Error('API Error'));

      await expect(service.processDiff(validDiff)).rejects.toThrow('Failed to process diff: API Error');
    });

    it('should reject invalid diffs', async () => {
      await expect(service.processDiff('invalid diff')).rejects.toThrow('Invalid diff content provided');
    });

    it('should calculate confidence scores correctly', async () => {
      // Test with a longer, more structured diff for higher confidence
      const structuredDiff = `diff --git a/src/feature.js b/src/feature.js
index 1234567..abcdefg 100644
--- a/src/feature.js
+++ b/src/feature.js
@@ -1,10 +1,15 @@
${Array(20).fill('// structured content line').join('\n')}`;

      mockOpenAIClient.generateSummary.mockResolvedValue('Detailed summary of changes');

      const result = await service.processDiff(structuredDiff);
      
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('processMultipleDiffs', () => {
    const diffs = [
      'diff --git a/file1.js b/file1.js\n@@ -1,1 +1,2 @@\n+change1',
      'diff --git a/file2.js b/file2.js\n@@ -1,1 +1,2 @@\n+change2'
    ];

    it('should process multiple diffs sequentially', async () => {
      mockOpenAIClient.generateSummary
        .mockResolvedValueOnce('Summary for file1')
        .mockResolvedValueOnce('Summary for file2');
      mockOpenAIClient.detectChangeType
        .mockResolvedValue('feature');

      const results = await service.processMultipleDiffs(diffs);

      expect(results).toHaveLength(2);
      expect(results[0].summary).toBe('Summary for file1');
      expect(results[1].summary).toBe('Summary for file2');
      expect(mockOpenAIClient.generateSummary).toHaveBeenCalledTimes(2);
    });

    it('should handle empty diff array', async () => {
      const results = await service.processMultipleDiffs([]);
      expect(results).toEqual([]);
    });

    it('should fail fast when individual diffs fail', async () => {
      // Clear any previous mock setup
      mockOpenAIClient.generateSummary.mockClear();
      mockOpenAIClient.detectChangeType.mockClear();

      mockOpenAIClient.generateSummary
        .mockRejectedValueOnce(new Error('First diff failed'))
        .mockResolvedValueOnce('Summary for file2');
      mockOpenAIClient.detectChangeType
        .mockResolvedValue('feature');

      // Should throw on first failure and not continue processing
      await expect(service.processMultipleDiffs(diffs)).rejects.toThrow('First diff failed');

      // Should only attempt to process the first diff
      expect(mockOpenAIClient.generateSummary).toHaveBeenCalledTimes(1);
    });
  });

  describe('factory functions', () => {
    it('should create service with default dependencies', () => {
      const factoryService = createSummarizationService(mockOpenAIClient);
      expect(factoryService).toBeInstanceOf(SummarizationService);
    });

    it('should create service with custom template engine', () => {
      const factoryService = createSummarizationServiceWithTemplates(
        mockOpenAIClient,
        mockTemplateEngine
      );
      expect(factoryService).toBeInstanceOf(SummarizationService);
    });

    it('should accept custom configuration in factory', () => {
      const customConfig: Partial<DiffProcessingConfig> = {
        maxDiffLength: 1000
      };

      const factoryService = createSummarizationService(mockOpenAIClient, customConfig);
      expect(factoryService).toBeInstanceOf(SummarizationService);
    });
  });

  describe('configuration management', () => {
    it('should allow updating configuration', () => {
      const newConfig: Partial<DiffProcessingConfig> = {
        maxDiffLength: 5000,
        customContext: 'Updated context'
      };

      expect(() => {
        (service as SummarizationService).updateConfig(newConfig);
      }).not.toThrow();
    });

    it('should provide access to template engine', () => {
      const engine = (service as SummarizationService).getTemplateEngine();
      expect(engine).toBeDefined();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very short summaries', async () => {
      // Clear any previous mock setup completely
      mockOpenAIClient.generateSummary.mockReset();
      mockOpenAIClient.detectChangeType.mockReset();

      mockOpenAIClient.generateSummary.mockResolvedValue('Short');
      mockOpenAIClient.detectChangeType.mockResolvedValue('chore');

      const diff = 'diff --git a/file.js b/file.js\n@@ -1,1 +1,2 @@\n+line';
      const result = await service.processDiff(diff);

      expect(result.summary).toBe('Short');
      expect(result.confidence).toBeLessThan(0.5); // Lower confidence for short summary
    });

    it('should handle change type detection failures', async () => {
      mockOpenAIClient.generateSummary.mockResolvedValue('Good summary');
      mockOpenAIClient.detectChangeType.mockRejectedValue(new Error('Detection failed'));

      const diff = 'diff --git a/file.js b/file.js\n@@ -1,1 +1,2 @@\n+line';
      
      await expect(service.processDiff(diff)).rejects.toThrow('Failed to process diff');
    });

    it('should trim summary results', async () => {
      // Clear any previous mock setup
      mockOpenAIClient.generateSummary.mockClear();
      mockOpenAIClient.detectChangeType.mockClear();

      mockOpenAIClient.generateSummary.mockResolvedValue('  Summary with whitespace  ');
      mockOpenAIClient.detectChangeType.mockResolvedValue('feature');

      const diff = 'diff --git a/file.js b/file.js\n@@ -1,1 +1,2 @@\n+line';
      const result = await service.processDiff(diff);

      expect(result.summary).toBe('Summary with whitespace');
    });
  });

  describe('performance and rate limiting', () => {
    it('should add delays between multiple diff processing', async () => {
      // Clear any previous mock setup
      mockOpenAIClient.generateSummary.mockClear();
      mockOpenAIClient.detectChangeType.mockClear();

      const startTime = Date.now();
      
      mockOpenAIClient.generateSummary.mockResolvedValue('Summary');
      mockOpenAIClient.detectChangeType.mockResolvedValue('feature');

      const diffs = [
        'diff --git a/file1.js b/file1.js\n@@ -1,1 +1,2 @@\n+change1',
        'diff --git a/file2.js b/file2.js\n@@ -1,1 +1,2 @@\n+change2'
      ];

      await service.processMultipleDiffs(diffs);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should take at least 100ms due to the delay between processing
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should track processing time in metadata', async () => {
      // Clear any previous mock setup
      mockOpenAIClient.generateSummary.mockClear();
      mockOpenAIClient.detectChangeType.mockClear();

      mockOpenAIClient.generateSummary.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('Summary'), 50))
      );
      mockOpenAIClient.detectChangeType.mockResolvedValue('feature');

      const diff = 'diff --git a/file.js b/file.js\n@@ -1,1 +1,2 @@\n+line';
      const result = await service.processDiff(diff);

      expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(50);
    });
  });
}); 