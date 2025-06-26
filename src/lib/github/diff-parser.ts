/**
 * Diff Parsing Utilities
 * 
 * Comprehensive utilities for parsing, cleaning, and analyzing Git diffs.
 * Supports unified diff format, patch format, and raw diff content.
 * 
 * Features:
 * - Robust unified diff parsing with error handling
 * - Binary file detection and handling
 * - Whitespace normalization and cleaning
 * - File type detection and categorization
 * - Diff summarization and statistics
 * - Noise filtering (large files, generated files, etc.)
 * - Context extraction and highlighting
 */

export interface ParsedDiffFile {
  /** Original filename */
  filename: string;
  /** Previous filename (for renames) */
  previousFilename?: string;
  /** File change status */
  status: 'added' | 'deleted' | 'modified' | 'renamed' | 'copied' | 'unchanged';
  /** File type based on extension */
  fileType: string;
  /** Whether this is a binary file */
  isBinary: boolean;
  /** Whether this file is likely generated/auto-generated */
  isGenerated: boolean;
  /** Whether this is a large file (>1000 lines changed) */
  isLargeFile: boolean;
  /** Change statistics */
  stats: {
    additions: number;
    deletions: number;
    changes: number;
    contextLines: number;
  };
  /** Parsed hunks (sections of changes) */
  hunks: DiffHunk[];
  /** Original patch content */
  rawPatch?: string;
}

export interface DiffHunk {
  /** Header line (e.g., "@@ -1,4 +1,6 @@") */
  header: string;
  /** Start line in old file */
  oldStart: number;
  /** Number of lines in old file */
  oldLines: number;
  /** Start line in new file */
  newStart: number;
  /** Number of lines in new file */
  newLines: number;
  /** Context or description after @@ lines */
  context?: string;
  /** Individual line changes */
  lines: DiffLine[];
}

export interface DiffLine {
  /** Type of change */
  type: 'add' | 'delete' | 'context' | 'no-newline';
  /** Line content (without +/- prefix) */
  content: string;
  /** Line numbers */
  lineNumber: {
    old?: number;
    new?: number;
  };
  /** Whether this line contains only whitespace changes */
  isWhitespaceOnly: boolean;
  /** Highlighted content for display */
  highlighted?: string;
}

export interface DiffSummary {
  /** Total number of files changed */
  totalFiles: number;
  /** Files by change type */
  filesByType: {
    added: number;
    deleted: number;
    modified: number;
    renamed: number;
  };
  /** Files by file type */
  filesByExtension: Record<string, number>;
  /** Overall statistics */
  stats: {
    additions: number;
    deletions: number;
    changes: number;
    binaryFiles: number;
    largeFiles: number;
    generatedFiles: number;
  };
  /** Most significant changes */
  significantFiles: Array<{
    filename: string;
    changes: number;
    type: string;
  }>;
}

export interface DiffCleaningOptions {
  /** Remove whitespace-only changes */
  removeWhitespaceOnly?: boolean;
  /** Remove binary files */
  removeBinaryFiles?: boolean;
  /** Remove generated files */
  removeGeneratedFiles?: boolean;
  /** Remove large files (over this many changes) */
  largeFieThreshold?: number;
  /** Maximum context lines to include */
  maxContextLines?: number;
  /** File extensions to exclude */
  excludeExtensions?: string[];
  /** File patterns to exclude (regex) */
  excludePatterns?: string[];
}

/**
 * Main diff parser class
 */
export class DiffParser {
  /**
   * Parse unified diff text into structured format
   */
  static parseUnifiedDiff(diffText: string): ParsedDiffFile[] {
    if (!diffText || diffText.trim().length === 0) {
      return [];
    }

    const files: ParsedDiffFile[] = [];
    const lines = diffText.split('\n');
    let currentFile: Partial<ParsedDiffFile> | null = null;
    let currentHunk: Partial<DiffHunk> | null = null;
    let oldLineNumber = 0;
    let newLineNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      try {
        // New file header
        if (line.startsWith('diff --git')) {
          if (currentFile) {
            files.push(this.finalizeFile(currentFile));
          }
          currentFile = this.initializeFile(line);
          continue;
        }

        if (!currentFile) continue;

        // Binary file detection
        if (line.includes('Binary files') || line.includes('GIT binary patch')) {
          currentFile.isBinary = true;
          continue;
        }

        // File status indicators
        if (line.startsWith('new file mode')) {
          currentFile.status = 'added';
          continue;
        }
        if (line.startsWith('deleted file mode')) {
          currentFile.status = 'deleted';
          continue;
        }
        if (line.startsWith('rename from')) {
          currentFile.status = 'renamed';
          currentFile.previousFilename = line.substring(12);
          continue;
        }
        if (line.startsWith('copy from')) {
          currentFile.status = 'copied';
          currentFile.previousFilename = line.substring(10);
          continue;
        }

        // File paths
        if (line.startsWith('--- ')) {
          // Old file path - already extracted from diff --git line
          continue;
        }
        if (line.startsWith('+++ ')) {
          const newPath = line.substring(4).trim();
          if (newPath !== '/dev/null') {
            currentFile.filename = newPath.startsWith('b/') ? newPath.substring(2) : newPath;
          }
          continue;
        }

        // Hunk header
        if (line.startsWith('@@')) {
          if (currentHunk) {
            currentFile.hunks = currentFile.hunks || [];
            currentFile.hunks.push(this.finalizeHunk(currentHunk));
          }
          currentHunk = this.parseHunkHeader(line);
          if (currentHunk) {
            oldLineNumber = currentHunk.oldStart!;
            newLineNumber = currentHunk.newStart!;
          }
          continue;
        }

        // Content lines
        if (currentHunk && (line.startsWith(' ') || line.startsWith('+') || line.startsWith('-'))) {
          const diffLine = this.parseDiffLine(line, oldLineNumber, newLineNumber);
          currentHunk.lines = currentHunk.lines || [];
          currentHunk.lines.push(diffLine);

          // Update line numbers
          if (diffLine.type === 'delete' || diffLine.type === 'context') {
            oldLineNumber++;
          }
          if (diffLine.type === 'add' || diffLine.type === 'context') {
            newLineNumber++;
          }
        }

        // No newline indicator
        if (line.startsWith('\\ No newline at end of file')) {
          if (currentHunk?.lines && currentHunk.lines.length > 0) {
            const lastLine = currentHunk.lines[currentHunk.lines.length - 1];
            lastLine.type = 'no-newline';
          }
        }
      } catch (error) {
        console.warn(`Failed to parse diff line: ${line}`, error);
        continue;
      }
    }

    // Finalize last hunk and file
    if (currentHunk && currentFile) {
      currentFile.hunks = currentFile.hunks || [];
      currentFile.hunks.push(this.finalizeHunk(currentHunk));
    }
    if (currentFile) {
      files.push(this.finalizeFile(currentFile));
    }

    return files;
  }

  /**
   * Clean and filter diff files based on options
   */
  static cleanDiff(files: ParsedDiffFile[], options: DiffCleaningOptions = {}): ParsedDiffFile[] {
    const {
      removeWhitespaceOnly = false,
      removeBinaryFiles = false,
      removeGeneratedFiles = false,
      largeFieThreshold = 1000,
      maxContextLines = 50,
      excludeExtensions = [],
      excludePatterns = [],
    } = options;

    return files
      .filter(file => {
        // Filter binary files
        if (removeBinaryFiles && file.isBinary) return false;
        
        // Filter generated files
        if (removeGeneratedFiles && file.isGenerated) return false;
        
        // Filter large files
        if (file.stats.changes > largeFieThreshold) return false;
        
        // Filter by extension
        if (excludeExtensions.length > 0) {
          const ext = this.getFileExtension(file.filename);
          if (excludeExtensions.includes(ext)) return false;
        }
        
        // Filter by patterns
        if (excludePatterns.length > 0) {
          const patterns = excludePatterns.map(p => new RegExp(p));
          if (patterns.some(pattern => pattern.test(file.filename))) return false;
        }
        
        return true;
      })
      .map(file => {
        if (removeWhitespaceOnly || maxContextLines < Infinity) {
          const cleanedHunks = file.hunks.map(hunk => ({
            ...hunk,
            lines: hunk.lines
              .filter(line => !removeWhitespaceOnly || !line.isWhitespaceOnly)
              .slice(0, maxContextLines),
          }));
          
          return {
            ...file,
            hunks: cleanedHunks,
            stats: this.calculateFileStats(cleanedHunks),
          };
        }
        return file;
      });
  }

  /**
   * Generate summary of diff changes
   */
  static summarizeDiff(files: ParsedDiffFile[]): DiffSummary {
    const filesByType = { added: 0, deleted: 0, modified: 0, renamed: 0 };
    const filesByExtension: Record<string, number> = {};
    const stats = { additions: 0, deletions: 0, changes: 0, binaryFiles: 0, largeFiles: 0, generatedFiles: 0 };
    const significantFiles: Array<{ filename: string; changes: number; type: string }> = [];

    for (const file of files) {
      // Count by type
      if (file.status === 'added') filesByType.added++;
      else if (file.status === 'deleted') filesByType.deleted++;
      else if (file.status === 'modified') filesByType.modified++;
      else if (file.status === 'renamed') filesByType.renamed++;

      // Count by extension
      const ext = this.getFileExtension(file.filename);
      filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;

      // Aggregate stats
      stats.additions += file.stats.additions;
      stats.deletions += file.stats.deletions;
      stats.changes += file.stats.changes;
      if (file.isBinary) stats.binaryFiles++;
      if (file.isLargeFile) stats.largeFiles++;
      if (file.isGenerated) stats.generatedFiles++;

      // Track significant files
      if (file.stats.changes > 10) {
        significantFiles.push({
          filename: file.filename,
          changes: file.stats.changes,
          type: file.fileType,
        });
      }
    }

    // Sort significant files by change count
    significantFiles.sort((a, b) => b.changes - a.changes);

    return {
      totalFiles: files.length,
      filesByType,
      filesByExtension,
      stats,
      significantFiles: significantFiles.slice(0, 10), // Top 10
    };
  }

  /**
   * Extract context around specific lines
   */
  static extractContext(file: ParsedDiffFile, targetLineNumber: number, contextSize = 3): DiffLine[] {
    const allLines: DiffLine[] = [];
    
    for (const hunk of file.hunks) {
      allLines.push(...hunk.lines);
    }

    const targetIndex = allLines.findIndex(line => 
      line.lineNumber.new === targetLineNumber || line.lineNumber.old === targetLineNumber
    );

    if (targetIndex === -1) return [];

    const start = Math.max(0, targetIndex - contextSize);
    const end = Math.min(allLines.length, targetIndex + contextSize + 1);

    return allLines.slice(start, end);
  }

  // Private helper methods

  private static initializeFile(diffLine: string): Partial<ParsedDiffFile> {
    // Extract filename from "diff --git a/file b/file" format
    const match = diffLine.match(/diff --git a\/(.+) b\/(.+)/);
    const filename = match ? match[2] : '';
    
    return {
      filename,
      status: 'modified',
      fileType: this.getFileType(filename),
      isBinary: false,
      isGenerated: this.isGeneratedFile(filename),
      isLargeFile: false,
      stats: { additions: 0, deletions: 0, changes: 0, contextLines: 0 },
      hunks: [],
    };
  }

  private static finalizeFile(file: Partial<ParsedDiffFile>): ParsedDiffFile {
    const stats = this.calculateFileStats(file.hunks || []);
    return {
      filename: file.filename || '',
      previousFilename: file.previousFilename,
      status: file.status || 'modified',
      fileType: file.fileType || 'unknown',
      isBinary: file.isBinary || false,
      isGenerated: file.isGenerated || false,
      isLargeFile: stats.changes > 1000,
      stats,
      hunks: file.hunks || [],
      rawPatch: file.rawPatch,
    };
  }

  private static parseHunkHeader(line: string): Partial<DiffHunk> | null {
    const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
    if (!match) return null;

    return {
      header: line,
      oldStart: parseInt(match[1]),
      oldLines: parseInt(match[2] || '1'),
      newStart: parseInt(match[3]),
      newLines: parseInt(match[4] || '1'),
      context: match[5]?.trim() || undefined,
      lines: [],
    };
  }

  private static finalizeHunk(hunk: Partial<DiffHunk>): DiffHunk {
    return {
      header: hunk.header || '',
      oldStart: hunk.oldStart || 0,
      oldLines: hunk.oldLines || 0,
      newStart: hunk.newStart || 0,
      newLines: hunk.newLines || 0,
      context: hunk.context,
      lines: hunk.lines || [],
    };
  }

  private static parseDiffLine(line: string, oldLineNumber: number, newLineNumber: number): DiffLine {
    const type = line.startsWith('+') ? 'add' : line.startsWith('-') ? 'delete' : 'context';
    const content = line.substring(1);
    const isWhitespaceOnly = /^\s*$/.test(content) || /^[\s\t]+$/.test(content);

    const lineNumber: { old?: number; new?: number } = {};
    if (type === 'delete' || type === 'context') {
      lineNumber.old = oldLineNumber;
    }
    if (type === 'add' || type === 'context') {
      lineNumber.new = newLineNumber;
    }

    return {
      type,
      content,
      lineNumber,
      isWhitespaceOnly,
    };
  }

  private static calculateFileStats(hunks: DiffHunk[]): ParsedDiffFile['stats'] {
    let additions = 0;
    let deletions = 0;
    let contextLines = 0;

    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        switch (line.type) {
          case 'add':
            additions++;
            break;
          case 'delete':
            deletions++;
            break;
          case 'context':
            contextLines++;
            break;
        }
      }
    }

    return {
      additions,
      deletions,
      changes: additions + deletions,
      contextLines,
    };
  }

  private static getFileType(filename: string): string {
    const ext = this.getFileExtension(filename);
    const typeMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
      'css': 'css',
      'scss': 'scss',
      'html': 'html',
      'md': 'markdown',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml',
      'sql': 'sql',
      'sh': 'shell',
      'dockerfile': 'docker',
    };
    
    return typeMap[ext.toLowerCase()] || ext || 'unknown';
  }

  private static getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  private static isGeneratedFile(filename: string): boolean {
    const generatedPatterns = [
      /\.min\.(js|css)$/,
      /bundle\.(js|css)$/,
      /\.generated\./,
      /^dist\//,
      /^build\//,
      /node_modules\//,
      /package-lock\.json$/,
      /yarn\.lock$/,
      /composer\.lock$/,
      /Gemfile\.lock$/,
      /\.map$/,
      /coverage\//,
    ];

    return generatedPatterns.some(pattern => pattern.test(filename));
  }
}

/**
 * Diff highlighting utilities
 */
export class DiffHighlighter {
  /**
   * Highlight syntax within diff lines (basic implementation)
   */
  static highlightSyntax(line: DiffLine, fileType: string): DiffLine {
    // Basic keyword highlighting - can be enhanced with actual syntax highlighter
    let highlighted = line.content;
    
    if (fileType === 'javascript' || fileType === 'typescript') {
      const keywords = ['function', 'const', 'let', 'var', 'if', 'else', 'return', 'import', 'export'];
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'g');
        highlighted = highlighted.replace(regex, `<span class="keyword">${keyword}</span>`);
      }
    }

    return {
      ...line,
      highlighted,
    };
  }

  /**
   * Highlight word-level changes within a line
   */
  static highlightWordChanges(oldLine: string, newLine: string): { old: string; new: string } {
    // Simple word-level diff highlighting
    const oldWords = oldLine.split(/\s+/);
    const newWords = newLine.split(/\s+/);
    
    // Basic implementation - can be enhanced with proper word-diff algorithm
    let highlightedOld = oldLine;
    let highlightedNew = newLine;
    
    // Find unique words in each line
    const uniqueToOld = oldWords.filter(word => !newWords.includes(word));
    const uniqueToNew = newWords.filter(word => !oldWords.includes(word));
    
    // Highlight unique words
    for (const word of uniqueToOld) {
      highlightedOld = highlightedOld.replace(
        new RegExp(`\\b${word}\\b`, 'g'), 
        `<span class="removed-word">${word}</span>`
      );
    }
    
    for (const word of uniqueToNew) {
      highlightedNew = highlightedNew.replace(
        new RegExp(`\\b${word}\\b`, 'g'), 
        `<span class="added-word">${word}</span>`
      );
    }
    
    return { old: highlightedOld, new: highlightedNew };
  }
}

/**
 * Factory functions for common use cases
 */
export const DiffParserUtils = {
  /**
   * Parse and clean diff for display in UI
   */
  parseForDisplay: (diffText: string, options?: DiffCleaningOptions): ParsedDiffFile[] => {
    const parsed = DiffParser.parseUnifiedDiff(diffText);
    return DiffParser.cleanDiff(parsed, {
      removeWhitespaceOnly: true,
      removeBinaryFiles: false,
      removeGeneratedFiles: false,
      maxContextLines: 20,
      ...options,
    });
  },

  /**
   * Parse and clean diff for AI processing
   */
  parseForAI: (diffText: string): ParsedDiffFile[] => {
    const parsed = DiffParser.parseUnifiedDiff(diffText);
    return DiffParser.cleanDiff(parsed, {
      removeWhitespaceOnly: true,
      removeBinaryFiles: true,
      removeGeneratedFiles: true,
      largeFieThreshold: 500,
      maxContextLines: 10,
      excludeExtensions: ['map', 'lock'],
    });
  },

  /**
   * Get quick summary of changes
   */
  getQuickSummary: (diffText: string): string => {
    const parsed = DiffParser.parseUnifiedDiff(diffText);
    const summary = DiffParser.summarizeDiff(parsed);
    
    return `${summary.totalFiles} files changed, ${summary.stats.additions} insertions(+), ${summary.stats.deletions} deletions(-)`;
  },
}; 