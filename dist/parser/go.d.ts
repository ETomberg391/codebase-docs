import type { CodeFile, ModuleInfo } from '../types.js';
/**
 * Parser for Go files.
 * Extracts symbols, imports, and exported identifiers.
 * In Go, exported = capitalized first letter.
 */
export declare function parse(file: CodeFile): ModuleInfo;
//# sourceMappingURL=go.d.ts.map