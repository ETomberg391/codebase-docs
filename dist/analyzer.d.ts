import type { ModuleInfo, AnalysisResult } from './types.js';
interface AnalyzeOptions {
    /** Base path of the project (for loading tsconfig.json) */
    basePath?: string;
}
/**
 * Analyzes parsed modules to extract dependencies, compute metrics,
 * build a file tree, and generate a summary.
 */
export declare function analyze(modules: ModuleInfo[], options?: AnalyzeOptions): AnalysisResult;
export {};
//# sourceMappingURL=analyzer.d.ts.map