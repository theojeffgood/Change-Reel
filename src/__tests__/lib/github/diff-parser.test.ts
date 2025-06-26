import { DiffParser, DiffHighlighter, DiffParserUtils, type ParsedDiffFile, type DiffCleaningOptions } from '../../../lib/github/diff-parser';

// Sample unified diff text for testing
const simpleDiff = `diff --git a/src/utils.js b/src/utils.js
index 1234567..abcdefg 100644
--- a/src/utils.js
+++ b/src/utils.js
@@ -1,5 +1,7 @@
 function hello() {
-  console.log('Hello');
+  console.log('Hello World');
+  console.log('New line');
 }
 
 module.exports = { hello };`;

const multiFileDiff = `diff --git a/README.md b/README.md
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/README.md
@@ -0,0 +1,3 @@
+# Test Project
+
+A simple test project.
diff --git a/src/index.js b/src/index.js
deleted file mode 100644
index abcdefg..0000000
--- a/src/index.js
+++ /dev/null
@@ -1,2 +0,0 @@
-console.log('Hello');
-process.exit(0);`;

const binaryDiff = `diff --git a/image.png b/image.png
index 1234567..abcdefg 100644
GIT binary patch
Binary files a/image.png and b/image.png differ`;

const renameDiff = `diff --git a/old-name.js b/new-name.js
similarity index 100%
rename from old-name.js
rename to new-name.js`;

describe('DiffParser', () => {

  describe('parseUnifiedDiff', () => {
    it('should parse a simple diff correctly', () => {
      const result = DiffParser.parseUnifiedDiff(simpleDiff);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        filename: 'src/utils.js',
        status: 'modified',
        fileType: 'javascript',
        isBinary: false,
        isGenerated: false,
      });

      expect(result[0].hunks).toHaveLength(1);
      expect(result[0].hunks[0]).toMatchObject({
        oldStart: 1,
        oldLines: 5,
        newStart: 1,
        newLines: 7,
      });

      expect(result[0].hunks[0].lines).toHaveLength(7);
      expect(result[0].hunks[0].lines[0]).toMatchObject({
        type: 'context',
        content: 'function hello() {',
      });
      expect(result[0].hunks[0].lines[1]).toMatchObject({
        type: 'delete',
        content: '  console.log(\'Hello\');',
      });
      expect(result[0].hunks[0].lines[2]).toMatchObject({
        type: 'add',
        content: '  console.log(\'Hello World\');',
      });
    });

    it('should handle empty input', () => {
      expect(DiffParser.parseUnifiedDiff('')).toEqual([]);
      expect(DiffParser.parseUnifiedDiff('   ')).toEqual([]);
    });

    it('should parse multiple files', () => {
      const result = DiffParser.parseUnifiedDiff(multiFileDiff);

      expect(result).toHaveLength(2);
      
      // First file (added)
      expect(result[0]).toMatchObject({
        filename: 'README.md',
        status: 'added',
        fileType: 'markdown',
      });

      // Second file (deleted)
      expect(result[1]).toMatchObject({
        filename: 'src/index.js',
        status: 'deleted',
        fileType: 'javascript',
      });
    });

    it('should detect binary files', () => {
      const result = DiffParser.parseUnifiedDiff(binaryDiff);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        filename: 'image.png',
        isBinary: true,
      });
    });

    it('should handle renamed files', () => {
      const result = DiffParser.parseUnifiedDiff(renameDiff);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        filename: 'new-name.js',
        previousFilename: 'old-name.js',
        status: 'renamed',
      });
    });

    it('should calculate file statistics correctly', () => {
      const result = DiffParser.parseUnifiedDiff(simpleDiff);

      expect(result[0].stats).toEqual({
        additions: 2,
        deletions: 1,
        changes: 3,
        contextLines: 4,
      });
    });

    it('should detect large files', () => {
      // Create a diff with many changes
      const largeDiff = `diff --git a/large.js b/large.js
index 1234567..abcdefg 100644
--- a/large.js
+++ b/large.js
@@ -1,5 +1,1005 @@
 original line
` + 
      Array.from({ length: 1001 }, (_, i) => `+console.log(${i});`).join('\n');

      const result = DiffParser.parseUnifiedDiff(largeDiff);
      expect(result[0].isLargeFile).toBe(true);
    });

    it('should detect generated files', () => {
      const generatedDiff = `diff --git a/dist/bundle.min.js b/dist/bundle.min.js
index 1234567..abcdefg 100644
--- a/dist/bundle.min.js
+++ b/dist/bundle.min.js
@@ -1,1 +1,1 @@
-console.log("old");
+console.log("new");`;

      const result = DiffParser.parseUnifiedDiff(generatedDiff);
      expect(result[0].isGenerated).toBe(true);
    });

    it('should identify different file types', () => {
      const typedDiff = `diff --git a/app.tsx b/app.tsx
index 1234567..abcdefg 100644
--- a/app.tsx
+++ b/app.tsx
@@ -1,1 +1,1 @@
-const App = () => <div>old</div>;
+const App = () => <div>new</div>;`;

      const result = DiffParser.parseUnifiedDiff(typedDiff);
      expect(result[0].fileType).toBe('typescript');
    });

    it('should handle whitespace-only lines', () => {
      const whitespaceDiff = `diff --git a/test.js b/test.js
index 1234567..abcdefg 100644
--- a/test.js
+++ b/test.js
@@ -1,3 +1,3 @@
 function test() {
-  
+    
 }`;

      const result = DiffParser.parseUnifiedDiff(whitespaceDiff);
      expect(result[0].hunks[0].lines[1].isWhitespaceOnly).toBe(true);
      expect(result[0].hunks[0].lines[2].isWhitespaceOnly).toBe(true);
    });

    it('should handle line numbers correctly', () => {
      const result = DiffParser.parseUnifiedDiff(simpleDiff);
      const lines = result[0].hunks[0].lines;

      // Context line
      expect(lines[0].lineNumber).toEqual({ old: 1, new: 1 });
      
      // Deleted line
      expect(lines[1].lineNumber).toEqual({ old: 2 });
      
      // Added lines
      expect(lines[2].lineNumber).toEqual({ new: 2 });
      expect(lines[3].lineNumber).toEqual({ new: 3 });
    });
  });

  describe('cleanDiff', () => {
    let files: ParsedDiffFile[];

    beforeEach(() => {
      files = DiffParser.parseUnifiedDiff(simpleDiff);
    });

    it('should remove binary files when requested', () => {
      const binaryFiles = DiffParser.parseUnifiedDiff(binaryDiff);
      const options: DiffCleaningOptions = { removeBinaryFiles: true };
      
      const result = DiffParser.cleanDiff(binaryFiles, options);
      expect(result).toHaveLength(0);
    });

    it('should remove generated files when requested', () => {
      const generatedDiff = `diff --git a/package-lock.json b/package-lock.json
index 1234567..abcdefg 100644`;
      const generatedFiles = DiffParser.parseUnifiedDiff(generatedDiff);
      const options: DiffCleaningOptions = { removeGeneratedFiles: true };
      
      const result = DiffParser.cleanDiff(generatedFiles, options);
      expect(result).toHaveLength(0);
    });

    it('should filter by file extensions', () => {
      const options: DiffCleaningOptions = { excludeExtensions: ['js'] };
      
      const result = DiffParser.cleanDiff(files, options);
      expect(result).toHaveLength(0);
    });

    it('should filter by file patterns', () => {
      const options: DiffCleaningOptions = { excludePatterns: ['src/.*'] };
      
      const result = DiffParser.cleanDiff(files, options);
      expect(result).toHaveLength(0);
    });

    it('should limit context lines', () => {
      const options: DiffCleaningOptions = { maxContextLines: 1 };
      
      const result = DiffParser.cleanDiff(files, options);
      expect(result[0].hunks[0].lines).toHaveLength(1);
    });

    it('should remove whitespace-only changes', () => {
      const whitespaceDiff = `diff --git a/test.js b/test.js
@@ -1,2 +1,2 @@
-  
+    `;
      
      const whitespaceFiles = DiffParser.parseUnifiedDiff(whitespaceDiff);
      const options: DiffCleaningOptions = { removeWhitespaceOnly: true };
      
      const result = DiffParser.cleanDiff(whitespaceFiles, options);
      expect(result[0].hunks[0].lines).toHaveLength(0);
    });
  });

  describe('summarizeDiff', () => {
    it('should generate accurate summary', () => {
      const files = DiffParser.parseUnifiedDiff(multiFileDiff);
      const summary = DiffParser.summarizeDiff(files);

      expect(summary).toEqual({
        totalFiles: 2,
        filesByType: {
          added: 1,
          deleted: 1,
          modified: 0,
          renamed: 0,
        },
        filesByExtension: {
          md: 1,
          js: 1,
        },
        stats: {
          additions: 3,
          deletions: 2,
          changes: 5,
          binaryFiles: 0,
          largeFiles: 0,
          generatedFiles: 0,
        },
        significantFiles: [],
      });
    });

    it('should identify significant files', () => {
      // Create diff with significant changes
      const significantDiff = `diff --git a/big-change.js b/big-change.js
@@ -1,5 +1,20 @@` + 
        Array.from({ length: 15 }, (_, i) => `+console.log(${i});`).join('\n');

      const files = DiffParser.parseUnifiedDiff(significantDiff);
      const summary = DiffParser.summarizeDiff(files);

      expect(summary.significantFiles).toHaveLength(1);
      expect(summary.significantFiles[0]).toMatchObject({
        filename: 'big-change.js',
        changes: 14,
        type: 'javascript',
      });
    });
  });

  describe('extractContext', () => {
    it('should extract context around target line', () => {
      const files = DiffParser.parseUnifiedDiff(simpleDiff);
      const context = DiffParser.extractContext(files[0], 2, 1);

      expect(context).toHaveLength(3);
      expect(context[0].content).toBe('function hello() {');
      expect(context[1].content).toBe('  console.log(\'Hello\');');
      expect(context[2].content).toBe('  console.log(\'Hello World\');');
    });

    it('should handle non-existent line numbers', () => {
      const files = DiffParser.parseUnifiedDiff(simpleDiff);
      const context = DiffParser.extractContext(files[0], 999, 1);

      expect(context).toHaveLength(0);
    });
  });
});

describe('DiffHighlighter', () => {
  describe('highlightSyntax', () => {
    it('should highlight JavaScript keywords', () => {
      const line = {
        type: 'add' as const,
        content: 'function test() { return true; }',
        lineNumber: { new: 1 },
        isWhitespaceOnly: false,
      };

      const result = DiffHighlighter.highlightSyntax(line, 'javascript');
      
      expect(result.highlighted).toContain('<span class="keyword">function</span>');
      expect(result.highlighted).toContain('<span class="keyword">return</span>');
    });

    it('should preserve non-keyword content', () => {
      const line = {
        type: 'add' as const,
        content: 'const myVariable = 42;',
        lineNumber: { new: 1 },
        isWhitespaceOnly: false,
      };

      const result = DiffHighlighter.highlightSyntax(line, 'javascript');
      
      expect(result.highlighted).toContain('myVariable');
      expect(result.highlighted).toContain('42');
    });
  });

  describe('highlightWordChanges', () => {
    it('should highlight changed words', () => {
      const oldLine = 'Hello world from yesterday';
      const newLine = 'Hello world from today';

      const result = DiffHighlighter.highlightWordChanges(oldLine, newLine);

      expect(result.old).toContain('<span class="removed-word">yesterday</span>');
      expect(result.new).toContain('<span class="added-word">today</span>');
      expect(result.old).toContain('Hello world from');
      expect(result.new).toContain('Hello world from');
    });

    it('should handle completely different lines', () => {
      const oldLine = 'completely different';
      const newLine = 'totally changed';

      const result = DiffHighlighter.highlightWordChanges(oldLine, newLine);

      expect(result.old).toContain('<span class="removed-word">completely</span>');
      expect(result.old).toContain('<span class="removed-word">different</span>');
      expect(result.new).toContain('<span class="added-word">totally</span>');
      expect(result.new).toContain('<span class="added-word">changed</span>');
    });
  });
});

describe('DiffParserUtils', () => {
  describe('parseForDisplay', () => {
    it('should apply display-friendly options', () => {
      const result = DiffParserUtils.parseForDisplay(simpleDiff);
      
      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('src/utils.js');
    });

    it('should override default options', () => {
      const result = DiffParserUtils.parseForDisplay(simpleDiff, {
        maxContextLines: 1,
      });
      
      expect(result[0].hunks[0].lines).toHaveLength(1);
    });
  });

  describe('parseForAI', () => {
    it('should apply AI-friendly cleaning', () => {
      const binaryFiles = DiffParser.parseUnifiedDiff(binaryDiff);
      const result = DiffParserUtils.parseForAI(binaryDiff);
      
      expect(result).toHaveLength(0); // Binary files removed
    });
  });

  describe('getQuickSummary', () => {
    it('should return formatted summary string', () => {
      const summary = DiffParserUtils.getQuickSummary(multiFileDiff);
      
      expect(summary).toBe('2 files changed, 3 insertions(+), 2 deletions(-)');
    });

    it('should handle empty diff', () => {
      const summary = DiffParserUtils.getQuickSummary('');
      
      expect(summary).toBe('0 files changed, 0 insertions(+), 0 deletions(-)');
    });
  });
});

describe('Edge cases and error handling', () => {
  it('should handle malformed diff headers', () => {
    const malformedDiff = `diff --git invalid header
some random content
@@ invalid hunk header @@
+some line`;

    expect(() => DiffParser.parseUnifiedDiff(malformedDiff)).not.toThrow();
    const result = DiffParser.parseUnifiedDiff(malformedDiff);
    expect(result).toHaveLength(1); // Creates a file with empty data
  });

  it('should handle diff without hunks', () => {
    const noHunksDiff = `diff --git a/empty.txt b/empty.txt
new file mode 100644
index 0000000..e69de29`;

    const result = DiffParser.parseUnifiedDiff(noHunksDiff);
    expect(result).toHaveLength(1);
    expect(result[0].hunks).toHaveLength(0);
    expect(result[0].status).toBe('added');
  });

  it('should handle very long lines', () => {
    const longLine = 'x'.repeat(10000);
    const longLineDiff = `diff --git a/long.js b/long.js
@@ -1,1 +1,1 @@
-${longLine}
+${longLine}modified`;

    expect(() => DiffParser.parseUnifiedDiff(longLineDiff)).not.toThrow();
    const result = DiffParser.parseUnifiedDiff(longLineDiff);
    expect(result[0].hunks[0].lines[0].content).toHaveLength(10000);
  });

  it('should handle special characters and unicode', () => {
    const unicodeDiff = `diff --git a/unicode.js b/unicode.js
@@ -1,1 +1,1 @@
-console.log('🔥 fire');
+console.log('❄️ snow');`;

    const result = DiffParser.parseUnifiedDiff(unicodeDiff);
    expect(result[0].hunks[0].lines[0].content).toBe('console.log(\'🔥 fire\');');
    expect(result[0].hunks[0].lines[1].content).toBe('console.log(\'❄️ snow\');');
  });
}); 