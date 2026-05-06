import { describe, it, expect } from 'vitest';
import { analyze } from '../src/analyzer.js';
import type { ModuleInfo } from '../src/types.js';

describe('analyzer', () => {
  function detectLanguage(path: string): import('../src/types.js').Language {
    if (path.endsWith('.py')) return 'python';
    if (path.endsWith('.go')) return 'go';
    if (path.endsWith('.rs')) return 'rust';
    if (path.endsWith('.java')) return 'java';
    return 'typescript';
  }

  function createModule(path: string, imports: string[] = [], exports: string[] = [], symbols: string[] = []): ModuleInfo {
    return {
      path,
      language: detectLanguage(path),
      imports: imports.map(src => ({
        source: src,
        importedNames: [src],
        isDefault: false,
        isTypeOnly: false,
        line: 1,
      })),
      exports: exports.map(name => ({
        name,
        isDefault: false,
        isType: false,
        line: 1,
      })),
      symbols: symbols.map(name => ({
        name,
        kind: 'function',
        line: 1,
        endLine: 1,
        snippet: '',
      })),
      content: '',
    };
  }

  it('extracts dependencies between modules', () => {
    const modules: ModuleInfo[] = [
      createModule('src/index.ts', ['./utils'], ['init'], ['init']),
      createModule('src/utils.ts', [], ['helper'], ['helper']),
    ];

    const result = analyze(modules);

    expect(result.dependencies.length).toBe(1);
    expect(result.dependencies[0].from).toBe('src/index.ts');
    expect(result.dependencies[0].to).toBe('src/utils.ts');
  });

  it('computes module metrics', () => {
    const modules: ModuleInfo[] = [
      createModule('src/index.ts', ['./utils'], ['init'], ['init']),
      createModule('src/utils.ts', [], ['helper'], ['helper']),
    ];

    const result = analyze(modules);

    expect(result.metrics.length).toBe(2);
    
    const indexMetrics = result.metrics.find(m => m.path === 'src/index.ts');
    expect(indexMetrics).toBeDefined();
    expect(indexMetrics!.dependencyCount).toBe(1);
    expect(indexMetrics!.dependentCount).toBe(0);

    const utilsMetrics = result.metrics.find(m => m.path === 'src/utils.ts');
    expect(utilsMetrics).toBeDefined();
    expect(utilsMetrics!.dependencyCount).toBe(0);
    expect(utilsMetrics!.dependentCount).toBe(1);
  });

  it('builds file tree', () => {
    const modules: ModuleInfo[] = [
      createModule('src/index.ts'),
      createModule('src/utils.ts'),
      createModule('src/components/Button.tsx'),
    ];

    const result = analyze(modules);

    expect(result.fileTree.length).toBe(1);
    expect(result.fileTree[0].name).toBe('src');
    expect(result.fileTree[0].isFile).toBe(false);
    expect(result.fileTree[0].children.length).toBeGreaterThan(0);
  });

  it('generates summary', () => {
    const modules: ModuleInfo[] = [
      createModule('src/index.ts', [], ['init'], ['init']),
      createModule('src/utils.ts', [], ['helper'], ['helper']),
      createModule('lib/helper.py', [], ['run'], ['run']),
    ];

    const result = analyze(modules);

    expect(result.summary.totalFiles).toBe(3);
    expect(result.summary.totalSymbols).toBe(3);
    expect(result.summary.languages).toBeDefined();
    expect(result.summary.languages.typescript).toBe(2);
    expect(result.summary.languages.python).toBe(1);
  });

  it('handles modules with no dependencies', () => {
    const modules: ModuleInfo[] = [
      createModule('src/standalone.ts'),
    ];

    const result = analyze(modules);

    expect(result.dependencies.length).toBe(0);
    expect(result.metrics[0].dependencyCount).toBe(0);
    expect(result.metrics[0].dependentCount).toBe(0);
  });

  it('handles circular dependencies', () => {
    const modules: ModuleInfo[] = [
      createModule('src/a.ts', ['./b'], ['a'], ['a']),
      createModule('src/b.ts', ['./a'], ['b'], ['b']),
    ];

    const result = analyze(modules);

    // Should handle circular deps without crashing
    expect(result.dependencies.length).toBe(2);
    expect(result.metrics[0].dependencyCount).toBe(1);
    expect(result.metrics[0].dependentCount).toBe(1);
  });

  it('filters external imports', () => {
    const modules: ModuleInfo[] = [
      createModule('src/index.ts', ['react', 'lodash', './utils'], ['init'], ['init']),
      createModule('src/utils.ts'),
    ];

    const result = analyze(modules);

    // Only relative imports should create dependency edges
    expect(result.dependencies.length).toBe(1);
    expect(result.dependencies[0].to).toBe('src/utils.ts');
  });

  it('resolves imports with extensions', () => {
    const modules: ModuleInfo[] = [
      createModule('src/index.ts', ['./utils.js'], ['init'], ['init']),
      createModule('src/utils.js', [], ['helper'], ['helper']),
    ];

    const result = analyze(modules);

    expect(result.dependencies.length).toBe(1);
  });
});
