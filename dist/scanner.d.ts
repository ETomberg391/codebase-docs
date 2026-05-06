import type { CodeFile, Language } from './types.js';
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
export declare function scanDirectory(basePath: string, options?: ScanOptions): CodeFile[];
//# sourceMappingURL=scanner.d.ts.map