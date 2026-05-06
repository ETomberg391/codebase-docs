import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  ModuleInfo,
  DependencyEdge,
  ModuleMetrics,
  TreeNode,
  Summary,
  AnalysisResult,
  Language,
} from './types.js';

interface PathAlias {
  pattern: string;
  target: string;
}

interface AnalyzeOptions {
  /** Base path of the project (for loading tsconfig.json) */
  basePath?: string;
}
/**
 * Loads path aliases from tsconfig.json.
 */
function loadPathAliases(basePath: string): PathAlias[] {
  const aliases: PathAlias[] = [];
  const tsconfigPath = path.join(basePath, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) return aliases;

  try {
    const content = fs.readFileSync(tsconfigPath, 'utf-8');
    const config = JSON.parse(content);
    const paths = config.compilerOptions?.paths;
    if (!paths || typeof paths !== 'object') return aliases;

    for (const [pattern, targets] of Object.entries(paths)) {
      if (Array.isArray(targets) && targets.length > 0) {
        aliases.push({ pattern, target: targets[0] });
      }
    }
  } catch {
    // Ignore parse errors
  }

  return aliases;
}

/**
 * Resolves a path alias pattern to an actual path.
 */
function resolvePathAlias(importSource: string, aliases: PathAlias[]): string | null {
  for (const { pattern, target } of aliases) {
    const regexPattern = pattern.replace(/\*/g, '(.+)');
    const regex = new RegExp('^' + regexPattern + '$');
    const match = importSource.match(regex);
    if (match) {
      return target.replace(/\*/, match[1]);
    }
  }
  return null;
}

/**
 * Analyzes parsed modules to extract dependencies, compute metrics,
 * build a file tree, and generate a summary.
 */
export function analyze(modules: ModuleInfo[], options: AnalyzeOptions = {}): AnalysisResult {
  const pathAliases = options.basePath ? loadPathAliases(options.basePath) : [];
  const dependencies = extractDependencies(modules, pathAliases);
  const metrics = computeMetrics(modules, dependencies);
  const fileTree = buildFileTree(modules);
  const summary = computeSummary(modules, dependencies);

  return {
    modules,
    dependencies,
    metrics,
    fileTree,
    summary,
  };
}

/**
 * Resolves an import source to a module path.
 * Handles relative paths, path aliases, and extension resolution.
 */
function resolveImportSource(
  importSource: string,
  fromPath: string,
  modules: ModuleInfo[],
  pathAliases: PathAlias[],
): string | null {
  // Try path alias resolution first for non-relative imports
  let resolved = importSource;
  if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
    const aliasResolved = resolvePathAlias(importSource, pathAliases);
    if (aliasResolved) {
      resolved = aliasResolved;
    } else {
      return null; // External/standard library import
    }
  }

  // For relative imports, resolve the path
  if (importSource.startsWith('.') || importSource.startsWith('/')) {
    const fromDir = path.dirname(fromPath);
    resolved = path.normalize(path.join(fromDir, resolved));
    if (resolved.startsWith('./')) {
      resolved = resolved.slice(2);
    }
  }

  // Try exact match first
  if (modules.find(m => m.path === resolved)) {
    return resolved;
  }

  // Try with extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go'];
  for (const ext of extensions) {
    const withExt = resolved + ext;
    if (modules.find(m => m.path === withExt)) {
      return withExt;
    }
  }

  // Try index files in directory
  for (const indexName of ['index.ts', 'index.js', 'index.tsx', '__init__.py', 'main.go']) {
    const indexPath = path.join(resolved, indexName);
    if (modules.find(m => m.path === indexPath)) {
      return indexPath;
    }
  }

  // Try without extension (for Python)
  if (modules.find(m => m.path === resolved)) {
    return resolved;
  }

  return null;
}

function extractDependencies(modules: ModuleInfo[], pathAliases: PathAlias[]): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  const seen = new Set<string>();

  for (const module of modules) {
    for (const imp of module.imports) {
      const targetPath = resolveImportSource(imp.source, module.path, modules, pathAliases);
      if (!targetPath) continue;

      const edgeKey = `${module.path}→${targetPath}`;
      if (seen.has(edgeKey)) continue;
      seen.add(edgeKey);

      edges.push({
        from: module.path,
        to: targetPath,
        importedSymbols: imp.importedNames,
      });
    }
  }

  return edges;
}

function computeMetrics(modules: ModuleInfo[], dependencies: DependencyEdge[]): ModuleMetrics[] {
  // Build adjacency info
  const dependencyCount = new Map<string, number>();
  const dependentCount = new Map<string, number>();

  for (const edge of dependencies) {
    dependencyCount.set(edge.from, (dependencyCount.get(edge.from) || 0) + 1);
    dependentCount.set(edge.to, (dependentCount.get(edge.to) || 0) + 1);
  }

  return modules.map(mod => ({
    path: mod.path,
    symbolCount: mod.symbols.length,
    importCount: mod.imports.length,
    exportCount: mod.exports.length,
    dependencyCount: dependencyCount.get(mod.path) || 0,
    dependentCount: dependentCount.get(mod.path) || 0,
  }));
}

function buildFileTree(modules: ModuleInfo[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [], isFile: false };

  for (const mod of modules) {
    const parts = mod.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const partialPath = parts.slice(0, i + 1).join('/');

      let existing: TreeNode | undefined;
      for (const child of current.children) {
        if (child.name === part) {
          existing = child;
          break;
        }
      }

      if (existing) {
        current = existing;
      } else {
        const newNode: TreeNode = {
          name: part,
          path: partialPath,
          children: [],
          isFile: isLast,
          module: isLast ? mod : undefined,
        };
        current.children.push(newNode);
        current = newNode;
      }
    }
  }

  // Sort: directories first, then files, alphabetically within each group
  function sortTree(node: TreeNode): void {
    node.children.sort((a, b) => {
      if (a.isFile !== b.isFile) {
        return a.isFile ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });
    for (const child of node.children) {
      sortTree(child);
    }
  }

  sortTree(root);
  return root.children;
}

function computeSummary(modules: ModuleInfo[], dependencies: DependencyEdge[]): Summary {
  const languages: Record<Language, number> = {} as any;
  let totalSymbols = 0;

  for (const mod of modules) {
    languages[mod.language] = (languages[mod.language] || 0) + 1;
    totalSymbols += mod.symbols.length;
  }

  return {
    totalFiles: modules.length,
    totalModules: modules.filter(m => m.symbols.length > 0 || m.exports.length > 0).length,
    totalSymbols,
    totalDependencies: dependencies.length,
    languages,
  };
}
