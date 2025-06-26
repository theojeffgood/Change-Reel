import { NoiseFilter, NoiseFilterPresets, NoiseFilterUtils, type NoiseFilterConfig } from '../../../lib/github/noise-filter';
import { type ParsedDiffFile } from '../../../lib/github/diff-parser';

// Test data factory
const createTestFile = (
  filename: string,
  overrides: Partial<ParsedDiffFile> = {}
): ParsedDiffFile => ({
  filename,
  status: 'modified',
  fileType: 'javascript',
  isBinary: false,
  isGenerated: false,
  isLargeFile: false,
  stats: {
    additions: 5,
    deletions: 3,
    changes: 8,
    contextLines: 2,
  },
  hunks: [
    {
      header: '@@ -1,5 +1,5 @@',
      oldStart: 1,
      oldLines: 5,
      newStart: 1,
      newLines: 5,
      lines: [
        {
          type: 'context',
          content: 'function test() {',
          lineNumber: { old: 1, new: 1 },
          isWhitespaceOnly: false,
        },
        {
          type: 'delete',
          content: '  console.log("old");',
          lineNumber: { old: 2 },
          isWhitespaceOnly: false,
        },
        {
          type: 'add',
          content: '  console.log("new");',
          lineNumber: { new: 2 },
          isWhitespaceOnly: false,
        },
        {
          type: 'context',
          content: '}',
          lineNumber: { old: 3, new: 3 },
          isWhitespaceOnly: false,
        },
      ],
    },
  ],
  ...overrides,
});

describe('NoiseFilter', () => {
  describe('Basic filtering', () => {
    it('should filter binary files when configured', () => {
      const files = [
        createTestFile('image.png', { isBinary: true }),
        createTestFile('script.js'),
      ];

      const filter = new NoiseFilter({ removeBinaryFiles: true });
      const result = filter.filter(files);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].filename).toBe('script.js');
      expect(result.removedFiles).toHaveLength(1);
      expect(result.removedFiles[0].reason).toBe('binary');
    });

    it('should filter generated files when configured', () => {
      const files = [
        createTestFile('bundle.min.js', { isGenerated: true }),
        createTestFile('source.js'),
      ];

      const filter = new NoiseFilter({ removeGeneratedFiles: true });
      const result = filter.filter(files);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].filename).toBe('source.js');
      expect(result.removedFiles[0].reason).toBe('generated');
    });

    it('should filter large files when configured', () => {
      const files = [
        createTestFile('huge.js', { 
          stats: { additions: 600, deletions: 400, changes: 1000, contextLines: 100 }
        }),
        createTestFile('small.js'),
      ];

      const filter = new NoiseFilter({ maxFileSize: 500 });
      const result = filter.filter(files);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].filename).toBe('small.js');
      expect(result.removedFiles[0].reason).toBe('large-file');
    });

    it('should filter by file extensions', () => {
      const files = [
        createTestFile('style.css'),
        createTestFile('script.js'),
      ];

      const filter = new NoiseFilter({ excludeExtensions: ['css'] });
      const result = filter.filter(files);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].filename).toBe('script.js');
      expect(result.removedFiles[0].reason).toBe('excluded-extension');
    });

    it('should filter by file patterns', () => {
      const files = [
        createTestFile('dist/bundle.js'),
        createTestFile('src/app.js'),
      ];

      const filter = new NoiseFilter({ excludePatterns: ['^dist/'] });
      const result = filter.filter(files);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].filename).toBe('src/app.js');
      expect(result.removedFiles[0].reason).toBe('excluded-pattern');
    });
  });

  describe('Content filtering', () => {
    it('should filter whitespace-only changes', () => {
      const files = [
        createTestFile('test.js', {
          hunks: [
            {
              header: '@@ -1,3 +1,3 @@',
              oldStart: 1,
              oldLines: 3,
              newStart: 1,
              newLines: 3,
              lines: [
                {
                  type: 'delete',
                  content: '  ',
                  lineNumber: { old: 1 },
                  isWhitespaceOnly: true,
                },
                {
                  type: 'add',
                  content: '    ',
                  lineNumber: { new: 1 },
                  isWhitespaceOnly: true,
                },
                {
                  type: 'context',
                  content: 'console.log("test");',
                  lineNumber: { old: 2, new: 2 },
                  isWhitespaceOnly: false,
                },
              ],
            },
          ],
        }),
      ];

      const filter = new NoiseFilter({ removeWhitespaceChanges: true });
      const result = filter.filter(files);

      expect(result.files[0].hunks[0].lines).toHaveLength(1);
      expect(result.files[0].hunks[0].lines[0].type).toBe('context');
    });

    it('should filter hunks by size', () => {
      const files = [
        createTestFile('test.js', {
          hunks: [
            {
              header: '@@ -1,10 +1,10 @@',
              oldStart: 1,
              oldLines: 10,
              newStart: 1,
              newLines: 10,
              lines: Array.from({ length: 20 }, (_, i) => ({
                type: 'add' as const,
                content: `line ${i}`,
                lineNumber: { new: i + 1 },
                isWhitespaceOnly: false,
              })),
            },
            {
              header: '@@ -20,2 +20,2 @@',
              oldStart: 20,
              oldLines: 2,
              newStart: 20,
              newLines: 2,
              lines: [
                {
                  type: 'add',
                  content: 'small hunk',
                  lineNumber: { new: 20 },
                  isWhitespaceOnly: false,
                },
              ],
            },
          ],
        }),
      ];

      const filter = new NoiseFilter({ maxHunkSize: 10 });
      const result = filter.filter(files);

      expect(result.files[0].hunks).toHaveLength(1);
      expect(result.files[0].hunks[0].lines).toHaveLength(1);
    });

    it('should filter by content ratio', () => {
      const files = [
        createTestFile('test.js', {
          hunks: [
            {
              header: '@@ -1,4 +1,4 @@',
              oldStart: 1,
              oldLines: 4,
              newStart: 1,
              newLines: 4,
              lines: [
                {
                  type: 'add',
                  content: '   ',
                  lineNumber: { new: 1 },
                  isWhitespaceOnly: true,
                },
                {
                  type: 'add',
                  content: '  ',
                  lineNumber: { new: 2 },
                  isWhitespaceOnly: true,
                },
                {
                  type: 'add',
                  content: 'meaningful content',
                  lineNumber: { new: 3 },
                  isWhitespaceOnly: false,
                },
              ],
            },
          ],
        }),
      ];

      const filter = new NoiseFilter({ minContentRatio: 0.5 });
      const result = filter.filter(files);

      expect(result.files[0].hunks).toHaveLength(0);
    });
  });

  describe('File type detection', () => {
    it('should detect development artifacts', () => {
      const files = [
        createTestFile('.DS_Store'),
        createTestFile('app.log'),
        createTestFile('temp.tmp'),
        createTestFile('normal.js'),
      ];

      const filter = new NoiseFilter({ removeDevArtifacts: true });
      const result = filter.filter(files);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].filename).toBe('normal.js');
      expect(result.removedFiles).toHaveLength(3);
    });

    it('should detect dependency files', () => {
      const files = [
        createTestFile('package-lock.json'),
        createTestFile('yarn.lock'),
        createTestFile('node_modules/package/index.js'),
        createTestFile('src/app.js'),
      ];

      const filter = new NoiseFilter({ removeDependencyFiles: true });
      const result = filter.filter(files);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].filename).toBe('src/app.js');
      expect(result.removedFiles).toHaveLength(3);
    });

    it('should detect test files', () => {
      const files = [
        createTestFile('app.test.js'),
        createTestFile('utils.spec.ts'),
        createTestFile('__tests__/helper.js'),
        createTestFile('src/app.js'),
      ];

      const filter = new NoiseFilter({ removeTestFiles: true });
      const result = filter.filter(files);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].filename).toBe('src/app.js');
      expect(result.removedFiles).toHaveLength(3);
    });

    it('should detect documentation files', () => {
      const files = [
        createTestFile('README.md'),
        createTestFile('CHANGELOG.txt'),
        createTestFile('docs/api.md'),
        createTestFile('src/app.js'),
      ];

      const filter = new NoiseFilter({ removeDocFiles: true });
      const result = filter.filter(files);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].filename).toBe('src/app.js');
      expect(result.removedFiles).toHaveLength(3);
    });
  });

  describe('Custom filters', () => {
    it('should apply custom filter functions', () => {
      const files = [
        createTestFile('important.js'),
        createTestFile('unimportant.js'),
      ];

      const customFilter = (file: ParsedDiffFile) => file.filename !== 'unimportant.js';
      const filter = new NoiseFilter({ customFilters: [customFilter] });
      const result = filter.filter(files);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].filename).toBe('important.js');
      expect(result.removedFiles[0].reason).toBe('custom-filter');
    });
  });

  describe('Statistics and reporting', () => {
    it('should calculate accurate statistics', () => {
      const files = [
        createTestFile('file1.js', { 
          stats: { additions: 10, deletions: 5, changes: 15, contextLines: 3 }
        }),
        createTestFile('file2.js', { 
          stats: { additions: 8, deletions: 2, changes: 10, contextLines: 1 }
        }),
        createTestFile('large.js', { 
          stats: { additions: 500, deletions: 300, changes: 800, contextLines: 50 }
        }),
      ];

      const filter = new NoiseFilter({ maxFileSize: 100 });
      const result = filter.filter(files);

      expect(result.stats.originalFiles).toBe(3);
      expect(result.stats.filteredFiles).toBe(2);
      expect(result.stats.removedFiles).toBe(1);
      expect(result.stats.originalLines).toBe(825); // 15 + 10 + 800
      expect(result.stats.removedLines).toBe(800);
      expect(result.stats.filterReasons).toEqual({
        'large-file': 1,
      });
      // Note: filteredLines depends on how filtering affects the actual content
      expect(result.stats.filteredLines).toBeGreaterThan(0);
    });

    it('should track removed files with reasons', () => {
      const files = [
        createTestFile('binary.png', { isBinary: true }),
        createTestFile('generated.min.js', { isGenerated: true }),
        createTestFile('normal.js'),
      ];

      const filter = new NoiseFilter({ 
        removeBinaryFiles: true,
        removeGeneratedFiles: true,
      });
      const result = filter.filter(files);

      expect(result.removedFiles).toEqual([
        {
          filename: 'binary.png',
          reason: 'binary',
          size: 8,
        },
        {
          filename: 'generated.min.js',
          reason: 'generated',
          size: 8,
        },
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty file list', () => {
      const filter = new NoiseFilter();
      const result = filter.filter([]);

      expect(result.files).toHaveLength(0);
      expect(result.stats.originalFiles).toBe(0);
      expect(result.removedFiles).toHaveLength(0);
    });

    it('should handle files with no hunks', () => {
      const files = [
        createTestFile('empty.js', { hunks: [] }),
      ];

      const filter = new NoiseFilter({ removeWhitespaceChanges: true });
      const result = filter.filter(files);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].hunks).toHaveLength(0);
    });

    it('should handle files with empty hunks after filtering', () => {
      const files = [
        createTestFile('test.js', {
          hunks: [
            {
              header: '@@ -1,1 +1,1 @@',
              oldStart: 1,
              oldLines: 1,
              newStart: 1,
              newLines: 1,
              lines: [
                {
                  type: 'add',
                  content: '   ',
                  lineNumber: { new: 1 },
                  isWhitespaceOnly: true,
                },
              ],
            },
          ],
        }),
      ];

      const filter = new NoiseFilter({ removeWhitespaceChanges: true });
      const result = filter.filter(files);

      expect(result.files[0].hunks).toHaveLength(0);
      expect(result.files[0].stats.changes).toBe(0);
    });
  });
});

describe('NoiseFilterPresets', () => {
  it('should have minimal preset', () => {
    const config = NoiseFilterPresets.minimal;
    expect(config.removeBinaryFiles).toBe(true);
    expect(config.removeGeneratedFiles).toBeUndefined();
    expect(config.maxFileSize).toBe(10000);
  });

  it('should have balanced preset', () => {
    const config = NoiseFilterPresets.balanced;
    expect(config.removeWhitespaceChanges).toBe(true);
    expect(config.removeBinaryFiles).toBe(true);
    expect(config.removeGeneratedFiles).toBe(true);
    expect(config.maxFileSize).toBe(2000);
  });

  it('should have aggressive preset', () => {
    const config = NoiseFilterPresets.aggressive;
    expect(config.removeWhitespaceChanges).toBe(true);
    expect(config.removeBinaryFiles).toBe(true);
    expect(config.removeGeneratedFiles).toBe(true);
    expect(config.removeDependencyFiles).toBe(true);
    expect(config.maxFileSize).toBe(500);
    expect(config.excludePatterns).toContain('^dist/');
  });

  it('should have codeReview preset', () => {
    const config = NoiseFilterPresets.codeReview;
    expect(config.removeWhitespaceChanges).toBe(true);
    expect(config.removeBinaryFiles).toBe(true);
    expect(config.removeDependencyFiles).toBe(true);
    expect(config.excludePatterns).toContain('\\.test\\.');
  });
});

describe('NoiseFilterUtils', () => {
  const testFiles = [
    createTestFile('src/app.js'),
    createTestFile('test.spec.js'),
    createTestFile('package-lock.json'),
  ];

  it('should create filter for AI processing', () => {
    const filter = NoiseFilterUtils.forAI();
    expect(filter).toBeInstanceOf(NoiseFilter);
  });

  it('should create filter for code review', () => {
    const filter = NoiseFilterUtils.forCodeReview();
    expect(filter).toBeInstanceOf(NoiseFilter);
  });

  it('should create filter for display', () => {
    const filter = NoiseFilterUtils.forDisplay();
    expect(filter).toBeInstanceOf(NoiseFilter);
  });

  it('should create minimal filter', () => {
    const filter = NoiseFilterUtils.minimal();
    expect(filter).toBeInstanceOf(NoiseFilter);
  });

  it('should create custom filter', () => {
    const config: NoiseFilterConfig = { removeTestFiles: true };
    const filter = NoiseFilterUtils.custom(config);
    expect(filter).toBeInstanceOf(NoiseFilter);
  });

  it('should quick filter files', () => {
    const result = NoiseFilterUtils.quickFilter(testFiles);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(testFiles.length);
  });

  it('should filter for summary', () => {
    const result = NoiseFilterUtils.forSummary(testFiles);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(testFiles.length);
  });
});

describe('Integration with real-world scenarios', () => {
  it('should handle typical React project files', () => {
    const files = [
      createTestFile('src/App.jsx'),
      createTestFile('src/components/Button.test.jsx'),
      createTestFile('public/favicon.ico', { isBinary: true }),
      createTestFile('package-lock.json'),
      createTestFile('dist/bundle.js', { isGenerated: true }),
      createTestFile('.DS_Store'),
      createTestFile('README.md'),
    ];

    const filter = NoiseFilterUtils.forCodeReview();
    const result = filter.filter(files);

    // Should keep main source file, filter out everything else for code review
    expect(result.files.length).toBeLessThan(files.length);
    expect(result.files.some(f => f.filename === 'src/App.jsx')).toBe(true);
  });

  it('should handle large commit with many changes', () => {
    const files = [
      // Create 50 small files
      ...Array.from({ length: 50 }, (_, i) => 
        createTestFile(`src/file${i}.js`, {
          stats: { additions: 2, deletions: 1, changes: 3, contextLines: 1 }
        })
      ),
      // Create 1 very large file
      createTestFile('generated/large.js', {
        isGenerated: true,
        stats: { additions: 5000, deletions: 3000, changes: 8000, contextLines: 500 }
      }),
    ];

    const filter = NoiseFilterUtils.forAI();
    const result = filter.filter(files);

    expect(result.files.length).toBe(50); // Small files kept
    expect(result.removedFiles.some(f => f.filename === 'generated/large.js')).toBe(true);
    expect(result.stats.removedLines).toBeGreaterThan(7000);
  });
}); 