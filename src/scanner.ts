import * as fs from 'node:fs';
import * as path from 'node:path';
import { minimatch } from 'minimatch';
import type { CodeFile, Language } from './types.js';

// Extensions mapped to supported languages
const LANGUAGE_MAP: Record<string, Language> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
};

// Directories to always skip
const DEFAULT_IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.cache',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.tox',
  '.nox',
  '.eggs',
  '*.egg-info',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.vite',
  '.svelte-kit',
  'vendor',
  '.venv',
  'venv',
  'env',
  '.env',
  'coverage',
  '.nyc_output',
  'artifacts',
  '.terraform',
]);

// File patterns to skip (regex)
const IGNORE_PATTERNS = [
  /\.min\.(js|css)$/,
  /\.map$/,
  /\.d\.ts$/,           // TypeScript declaration files
  /\.spec\.(ts|js|tsx|jsx)$/,
  /\.test\.(ts|js|tsx|jsx)$/,
  /\.d\.ts\.x$/,
  /\.pyc$/,
  /\.pyo$/,
];

function shouldIgnoreDir(dirName: string): boolean {
  if (DEFAULT_IGNORE_DIRS.has(dirName)) {
    return true;
  }
  // Check glob patterns in DEFAULT_IGNORE_DIRS
  for (const pattern of DEFAULT_IGNORE_DIRS) {
    if (pattern.startsWith('*') && dirName.endsWith(pattern.slice(1))) {
      return true;
    }
  }
  return false;
}

function shouldIgnoreFile(filename: string): boolean {
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(filename)) {
      return true;
    }
  }
  return false;
}

function isBinary(content: Buffer): boolean {
  // Check first 8KB for null bytes
  const sample = content.slice(0, 8192);
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) {
      return true;
    }
  }
  return false;
}

function detectLanguage(filePath: string): Language {
  const ext = path.extname(filePath).toLowerCase();
  return LANGUAGE_MAP[ext] || 'unknown';
}

/**
 * Loads ignore patterns from .gitignore and .codebase-docs-ignore files.
 * Returns arrays of positive and negation patterns for proper gitignore-style matching.
 */
function loadCustomIgnore(basePath: string): { patterns: string[]; negations: string[] } {
  const patterns: string[] = [];
  const negations: string[] = [];

  for (const fileName of ['.gitignore', '.codebase-docs-ignore']) {
    const filePath = path.join(basePath, fileName);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Handle negation patterns (lines starting with !)
      if (trimmed.startsWith('!')) {
        negations.push(trimmed.slice(1));
      } else {
        patterns.push(trimmed);
      }
    }
  }

  return { patterns, negations };
}

/**
 * Checks if a relative path should be ignored based on gitignore-style patterns.
 * Handles directory patterns (trailing /), glob patterns, and negations.
 */
function shouldIgnoreByPatterns(
  relPath: string,
  isDirectory: boolean,
  customPatterns: string[],
  customNegations: string[],
): boolean {
  // Check negation patterns first (they un-ignore)
  for (const pattern of customNegations) {
    const matchPattern = pattern.endsWith('/') && isDirectory ? pattern : pattern;
    if (minimatch(relPath, matchPattern, { dot: true })) {
      return false;
    }
  }

  // Check ignore patterns
  for (const pattern of customPatterns) {
    // Directory-only patterns (trailing /) only match directories
    if (pattern.endsWith('/') && !isDirectory) {
      continue;
    }
    const matchPattern = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;
    if (minimatch(relPath, matchPattern, { dot: true })) {
      return true;
    }
  }

  return false;
}

export interface ScanOptions {
  /** Custom directories to ignore (in addition to defaults) */
  ignoreDirs?: string[];
  /** Custom file patterns to ignore (in addition to defaults) */
  ignorePatterns?: RegExp[];
  /** Only include files with these languages */
  languages?: Language[];
}

/**
 * Scans a directory recursively and returns a list of code files.
 * Respects .gitignore and default ignore patterns.
 */
export function scanDirectory(basePath: string, options: ScanOptions = {}): CodeFile[] {
  const resolvedPath = path.resolve(basePath);
  const { patterns: customPatterns, negations: customNegations } = loadCustomIgnore(resolvedPath);

  // Build combined ignore patterns: default dirs + custom patterns + option dirs
  const allPatterns = [
    ...Array.from(DEFAULT_IGNORE_DIRS).map(d => d.endsWith('/') ? d : d + '/'),
    ...customPatterns,
    ...(options.ignoreDirs ?? []).map((d: string) => d.endsWith('/') ? d : d + '/'),
  ];
  const allNegations = [...customNegations];
  const ignorePatterns = [...IGNORE_PATTERNS, ...(options.ignorePatterns ?? [])];

  const files: CodeFile[] = [];

  function walkDirectory(dirPath: string, relDir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const relPath = relDir ? path.join(relDir, entry.name) : entry.name;
        if (shouldIgnoreByPatterns(relPath, true, allPatterns, allNegations)) {
          continue;
        }
        walkDirectory(path.join(dirPath, entry.name), relPath);
      } else if (entry.isFile()) {
        if (shouldIgnoreFile(entry.name)) {
          continue;
        }

        // Check custom patterns against file path
        const relPath = relDir ? path.join(relDir, entry.name) : entry.name;
        if (shouldIgnoreByPatterns(relPath, false, allPatterns, allNegations)) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const language = detectLanguage(entry.name);

        if (language === 'unknown') {
          continue;
        }

        if (options.languages && !options.languages.includes(language)) {
          continue;
        }

        try {
          const content = fs.readFileSync(fullPath);
          if (isBinary(content)) {
            continue;
          }

          files.push({
            path: relPath,
            language,
            content: content.toString('utf-8'),
          });
        } catch {
          // Skip files that can't be read
        }
      }
    }
  }

  walkDirectory(resolvedPath, '');
  return files;
}
