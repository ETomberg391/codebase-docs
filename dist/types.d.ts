export type Language = 'typescript' | 'javascript' | 'python' | 'go' | 'unknown';
export interface CodeFile {
    path: string;
    language: Language;
    content: string;
}
export interface SymbolInfo {
    name: string;
    kind: SymbolKind;
    line: number;
    endLine: number;
    snippet: string;
    docComment?: string;
}
export type SymbolKind = 'class' | 'function' | 'interface' | 'type' | 'variable' | 'constant' | 'enum' | 'namespace' | 'module';
export interface ImportInfo {
    source: string;
    importedNames: string[];
    isDefault: boolean;
    isTypeOnly: boolean;
    line: number;
}
export interface ExportInfo {
    name: string;
    isDefault: boolean;
    isType: boolean;
    line: number;
}
export interface ModuleInfo {
    path: string;
    language: Language;
    symbols: SymbolInfo[];
    imports: ImportInfo[];
    exports: ExportInfo[];
    content?: string;
}
export interface DependencyEdge {
    from: string;
    to: string;
    importedSymbols: string[];
}
export interface ModuleMetrics {
    path: string;
    symbolCount: number;
    importCount: number;
    exportCount: number;
    dependencyCount: number;
    dependentCount: number;
}
export interface AnalysisResult {
    modules: ModuleInfo[];
    dependencies: DependencyEdge[];
    metrics: ModuleMetrics[];
    fileTree: TreeNode[];
    summary: Summary;
}
export interface TreeNode {
    name: string;
    path: string;
    children: TreeNode[];
    isFile: boolean;
    module?: ModuleInfo;
}
export interface Summary {
    totalFiles: number;
    totalModules: number;
    totalSymbols: number;
    totalDependencies: number;
    languages: Record<Language, number>;
}
export interface GeneratorOptions {
    outputPath?: string;
    title?: string;
    theme?: 'dark' | 'light';
}
//# sourceMappingURL=types.d.ts.map