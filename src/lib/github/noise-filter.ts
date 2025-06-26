/**
 * Noise Filtering for Git Diffs
 * 
 * Filters out noise and irrelevant changes from diffs to improve AI processing
 * and user focus on meaningful changes. Includes configurable rules for
 * different use cases (display, AI processing, summarization).
 */

import { type ParsedDiffFile, type DiffLine, type DiffHunk } from './diff-parser';

export interface NoiseFilterConfig {
  /** Remove whitespace-only changes */
  removeWhitespaceChanges?: boolean;
  /** Remove binary files */
  removeBinaryFiles?: boolean;
  /** Remove generated/compiled files */
  removeGeneratedFiles?: boolean;
  /** Remove files larger than this threshold (lines changed) */
  maxFileSize?: number;
  /** Remove hunks larger than this threshold (lines) */
  maxHunkSize?: number;
  /** Minimum meaningful content ratio (non-whitespace/total) */
  minContentRatio?: number;
  /** File extensions to exclude */
  excludeExtensions?: string[];
  /** File patterns to exclude (regex strings) */
  excludePatterns?: string[];
  /** Remove common development artifacts */
  removeDevArtifacts?: boolean;
  /** Remove dependency/package files */
  removeDependencyFiles?: boolean;
  /** Remove test files */
  removeTestFiles?: boolean;
  /** Remove documentation files */
  removeDocFiles?: boolean;
  /** Custom filter functions */
  customFilters?: Array<(file: ParsedDiffFile) => boolean>;
}

export interface FilterResult {
  /** Filtered files */
  files: ParsedDiffFile[];
  /** Statistics about filtering */
  stats: {
    originalFiles: number;
    filteredFiles: number;
    removedFiles: number;
    originalLines: number;
    filteredLines: number;
    removedLines: number;
    filterReasons: Record<string, number>;
  };
  /** Files that were removed and why */
  removedFiles: Array<{
    filename: string;
    reason: string;
    size: number;
  }>;
}

/**
 * Predefined filter configurations for common use cases
 */
export const NoiseFilterPresets = {
  /** Minimal filtering for maximum information retention */
  minimal: {
    removeBinaryFiles: true,
    removeDevArtifacts: false,
    maxFileSize: 10000,
  } as NoiseFilterConfig,

  /** Balanced filtering for general purpose use */
  balanced: {
    removeWhitespaceChanges: true,
    removeBinaryFiles: true,
    removeGeneratedFiles: true,
    removeDevArtifacts: true,
    maxFileSize: 2000,
    maxHunkSize: 100,
    minContentRatio: 0.1,
    excludeExtensions: ['map', 'min.js', 'min.css'],
  } as NoiseFilterConfig,

  /** Aggressive filtering for AI processing */
  aggressive: {
    removeWhitespaceChanges: true,
    removeBinaryFiles: true,
    removeGeneratedFiles: true,
    removeDevArtifacts: true,
    removeDependencyFiles: true,
    removeTestFiles: false, // Keep tests as they're often meaningful
    removeDocFiles: false, // Keep docs as they show intent
    maxFileSize: 500,
    maxHunkSize: 50,
    minContentRatio: 0.2,
    excludeExtensions: ['map', 'min.js', 'min.css', 'lock', 'log'],
    excludePatterns: [
      '^dist/',
      '^build/',
      '^coverage/',
      '\\.generated\\.',
      '\\.cache/',
      'node_modules/',
    ],
  } as NoiseFilterConfig,

  /** Focused filtering for code review */
  codeReview: {
    removeWhitespaceChanges: true,
    removeBinaryFiles: true,
    removeGeneratedFiles: true,
    removeDevArtifacts: true,
    removeDependencyFiles: true,
    maxFileSize: 1000,
    minContentRatio: 0.15,
    excludeExtensions: ['map', 'lock'],
    excludePatterns: ['^test/', '^spec/', '\\.test\\.', '\\.spec\\.'],
  } as NoiseFilterConfig,
} as const;

/**
 * Main noise filter class
 */
export class NoiseFilter {
  private config: Required<NoiseFilterConfig>;

  constructor(config: NoiseFilterConfig = {}) {
    this.config = {
      removeWhitespaceChanges: config.removeWhitespaceChanges ?? false,
      removeBinaryFiles: config.removeBinaryFiles ?? false,
      removeGeneratedFiles: config.removeGeneratedFiles ?? false,
      maxFileSize: config.maxFileSize ?? Infinity,
      maxHunkSize: config.maxHunkSize ?? Infinity,
      minContentRatio: config.minContentRatio ?? 0,
      excludeExtensions: config.excludeExtensions ?? [],
      excludePatterns: config.excludePatterns ?? [],
      removeDevArtifacts: config.removeDevArtifacts ?? false,
      removeDependencyFiles: config.removeDependencyFiles ?? false,
      removeTestFiles: config.removeTestFiles ?? false,
      removeDocFiles: config.removeDocFiles ?? false,
      customFilters: config.customFilters ?? [],
    };
  }

  /**
   * Filter diff files according to configuration
   */
  filter(files: ParsedDiffFile[]): FilterResult {
    const result: FilterResult = {
      files: [],
      stats: {
        originalFiles: files.length,
        filteredFiles: 0,
        removedFiles: 0,
        originalLines: 0,
        filteredLines: 0,
        removedLines: 0,
        filterReasons: {},
      },
      removedFiles: [],
    };

    // Calculate original stats
    result.stats.originalLines = files.reduce((total, file) => {
      return total + file.stats.changes;
    }, 0);

    for (const file of files) {
      const filterReason = this.shouldFilterFile(file);
      
      if (filterReason) {
        // File is filtered out
        result.stats.removedFiles++;
        result.stats.removedLines += file.stats.changes;
        result.stats.filterReasons[filterReason] = (result.stats.filterReasons[filterReason] || 0) + 1;
        
        result.removedFiles.push({
          filename: file.filename,
          reason: filterReason,
          size: file.stats.changes,
        });
      } else {
        // File passes filters, now filter its content
        const filteredFile = this.filterFileContent(file);
        result.files.push(filteredFile);
        result.stats.filteredFiles++;
        result.stats.filteredLines += filteredFile.stats.changes;
      }
    }

    return result;
  }

  /**
   * Check if a file should be filtered out entirely
   */
  private shouldFilterFile(file: ParsedDiffFile): string | null {
    // Binary files
    if (this.config.removeBinaryFiles && file.isBinary) {
      return 'binary';
    }

    // Generated files
    if (this.config.removeGeneratedFiles && file.isGenerated) {
      return 'generated';
    }

    // File size
    if (file.stats.changes > this.config.maxFileSize) {
      return 'large-file';
    }

    // File extensions
    if (this.config.excludeExtensions.length > 0) {
      const ext = this.getFileExtension(file.filename);
      if (this.config.excludeExtensions.includes(ext)) {
        return 'excluded-extension';
      }
    }

    // File patterns
    if (this.config.excludePatterns.length > 0) {
      for (const pattern of this.config.excludePatterns) {
        if (new RegExp(pattern).test(file.filename)) {
          return 'excluded-pattern';
        }
      }
    }

    // Development artifacts
    if (this.config.removeDevArtifacts && this.isDevArtifact(file.filename)) {
      return 'dev-artifact';
    }

    // Dependency files
    if (this.config.removeDependencyFiles && this.isDependencyFile(file.filename)) {
      return 'dependency-file';
    }

    // Test files
    if (this.config.removeTestFiles && this.isTestFile(file.filename)) {
      return 'test-file';
    }

    // Documentation files
    if (this.config.removeDocFiles && this.isDocFile(file.filename)) {
      return 'doc-file';
    }

    // Custom filters
    for (const customFilter of this.config.customFilters) {
      if (!customFilter(file)) {
        return 'custom-filter';
      }
    }

    return null;
  }

  /**
   * Filter content within a file (hunks and lines)
   */
  private filterFileContent(file: ParsedDiffFile): ParsedDiffFile {
    let filteredHunks = file.hunks;

    // Filter hunks by size
    if (this.config.maxHunkSize < Infinity) {
      filteredHunks = filteredHunks.filter(hunk => hunk.lines.length <= this.config.maxHunkSize);
    }

    // Filter whitespace-only changes
    if (this.config.removeWhitespaceChanges) {
      filteredHunks = filteredHunks.map(hunk => ({
        ...hunk,
        lines: hunk.lines.filter(line => !this.isWhitespaceOnlyChange(line)),
      })).filter(hunk => hunk.lines.length > 0);
    }

    // Check content ratio
    if (this.config.minContentRatio > 0) {
      filteredHunks = filteredHunks.filter(hunk => {
        const meaningfulLines = hunk.lines.filter(line => !line.isWhitespaceOnly).length;
        const ratio = meaningfulLines / hunk.lines.length;
        return ratio >= this.config.minContentRatio;
      });
    }

    // Recalculate stats for filtered file
    const filteredStats = this.calculateStats(filteredHunks);

    return {
      ...file,
      hunks: filteredHunks,
      stats: filteredStats,
    };
  }

  /**
   * Check if a line represents only whitespace changes
   */
  private isWhitespaceOnlyChange(line: DiffLine): boolean {
    if (line.type === 'context') return false;
    
    // Check if the line contains only whitespace characters
    return /^\s*$/.test(line.content) || 
           line.isWhitespaceOnly ||
           /^[\s\t]*$/.test(line.content.trim());
  }

  /**
   * Calculate statistics for filtered hunks
   */
  private calculateStats(hunks: DiffHunk[]): ParsedDiffFile['stats'] {
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

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * Check if file is a development artifact
   */
  private isDevArtifact(filename: string): boolean {
    const devPatterns = [
      /\.log$/,
      /\.cache/,
      /\.tmp$/,
      /\.temp$/,
      /\.DS_Store$/,
      /Thumbs\.db$/,
      /\.env\.local$/,
      /\.env\.development$/,
      /\.env\.production$/,
      /\.swp$/,
      /\.swo$/,
      /~$/,
    ];

    return devPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Check if file is a dependency/package file
   */
  private isDependencyFile(filename: string): boolean {
    const dependencyPatterns = [
      /package-lock\.json$/,
      /yarn\.lock$/,
      /pnpm-lock\.yaml$/,
      /composer\.lock$/,
      /Gemfile\.lock$/,
      /Pipfile\.lock$/,
      /poetry\.lock$/,
      /Cargo\.lock$/,
      /go\.sum$/,
      /node_modules\//,
      /vendor\//,
      /\.pip$/,
    ];

    return dependencyPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Check if file is a test file
   */
  private isTestFile(filename: string): boolean {
    const testPatterns = [
      /\.test\./,
      /\.spec\./,
      /_test\./,
      /_spec\./,
      /^test\//,
      /^tests\//,
      /^spec\//,
      /^__tests__\//,
      /\.test$/,
      /\.spec$/,
      /test_.*\.py$/,
      /.*_test\.go$/,
      /.*Test\.java$/,
      /.*Spec\.scala$/,
    ];

    return testPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Check if file is a documentation file
   */
  private isDocFile(filename: string): boolean {
    const docPatterns = [
      /\.md$/,
      /\.txt$/,
      /\.rst$/,
      /\.adoc$/,
      /README/i,
      /CHANGELOG/i,
      /LICENSE/i,
      /CONTRIBUTING/i,
      /AUTHORS/i,
      /NOTICE/i,
      /^docs\//,
      /^documentation\//,
      /\.man$/,
      /\.1$/,
    ];

    return docPatterns.some(pattern => pattern.test(filename));
  }
}

/**
 * Factory functions for common filtering scenarios
 */
export const NoiseFilterUtils = {
  /**
   * Create filter for AI processing with aggressive noise removal
   */
  forAI: () => new NoiseFilter(NoiseFilterPresets.aggressive),

  /**
   * Create filter for code review with focused relevant changes
   */
  forCodeReview: () => new NoiseFilter(NoiseFilterPresets.codeReview),

  /**
   * Create filter for display with balanced noise removal
   */
  forDisplay: () => new NoiseFilter(NoiseFilterPresets.balanced),

  /**
   * Create minimal filter that preserves most content
   */
  minimal: () => new NoiseFilter(NoiseFilterPresets.minimal),

  /**
   * Create custom filter with specific configuration
   */
  custom: (config: NoiseFilterConfig) => new NoiseFilter(config),

  /**
   * Quick filter using balanced preset
   */
  quickFilter: (files: ParsedDiffFile[]): ParsedDiffFile[] => {
    const filter = new NoiseFilter(NoiseFilterPresets.balanced);
    return filter.filter(files).files;
  },

  /**
   * Filter for summarization (very aggressive)
   */
  forSummary: (files: ParsedDiffFile[]): ParsedDiffFile[] => {
    const config: NoiseFilterConfig = {
      ...NoiseFilterPresets.aggressive,
      maxFileSize: 100, // Very small files only
      maxHunkSize: 20,  // Very small hunks only
      minContentRatio: 0.3,
    };
    const filter = new NoiseFilter(config);
    return filter.filter(files).files;
  },
}; 