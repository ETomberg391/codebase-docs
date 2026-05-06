import { describe, it, expect } from 'vitest';
import { generate } from '../src/generator.js';
import type { AnalysisResult, ModuleInfo, ModuleMetrics, TreeNode, Summary } from '../src/types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('generator', () => {
  function createMinimalResult(): AnalysisResult {
    const modules: ModuleInfo[] = [
      {
        path: 'src/index.ts',
        language: 'typescript',
        imports: [],
        exports: [{ name: 'init', isDefault: false, isType: false, line: 1 }],
        symbols: [{ name: 'init', kind: 'function', line: 1, endLine: 5, snippet: 'function init() {}' }],
        content: '',
      },
      {
        path: 'src/utils.ts',
        language: 'typescript',
        imports: [],
        exports: [{ name: 'helper', isDefault: false, isType: false, line: 1 }],
        symbols: [{ name: 'helper', kind: 'function', line: 1, endLine: 3, snippet: 'function helper() {}' }],
        content: '',
      },
    ];

    const fileTree: TreeNode[] = [
      {
        name: 'src',
        path: 'src',
        isFile: false,
        children: [
          { name: 'index.ts', path: 'src/index.ts', isFile: true, children: [], module: modules[0] },
          { name: 'utils.ts', path: 'src/utils.ts', isFile: true, children: [], module: modules[1] },
        ],
      },
    ];

    const summary: Summary = {
      totalFiles: 2,
      totalModules: 2,
      totalSymbols: 2,
      totalDependencies: 0,
      languages: { typescript: 2 },
    };

    return {
      modules,
      dependencies: [],
      metrics: [
        { path: 'src/index.ts', symbolCount: 1, importCount: 0, exportCount: 1, dependencyCount: 0, dependentCount: 0 },
        { path: 'src/utils.ts', symbolCount: 1, importCount: 0, exportCount: 1, dependencyCount: 0, dependentCount: 0 },
      ],
      fileTree,
      summary,
    };
  }

  it('generates valid HTML file', () => {
    const tmpDir = path.join(__dirname, 'tmp-gen-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, 'output.html');

    const result = createMinimalResult();
    const output = generate(result, { outputPath });

    expect(output).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('</html>');
    expect(content).toContain('Codebase Documentation');

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('includes embedded data', () => {
    const tmpDir = path.join(__dirname, 'tmp-gen-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, 'output.html');

    const result = createMinimalResult();
    generate(result, { outputPath });

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('DATA');
    expect(content).toContain('src/index.ts');
    expect(content).toContain('src/utils.ts');

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('includes CSS styles', () => {
    const tmpDir = path.join(__dirname, 'tmp-gen-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, 'output.html');

    const result = createMinimalResult();
    generate(result, { outputPath });

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('<style>');
    expect(content).toContain('.header');
    expect(content).toContain('.module-card');

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('includes JavaScript', () => {
    const tmpDir = path.join(__dirname, 'tmp-gen-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, 'output.html');

    const result = createMinimalResult();
    generate(result, { outputPath });

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('<script>');
    expect(content).toContain('renderFileTree');
    expect(content).toContain('renderModules');

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('uses custom title', () => {
    const tmpDir = path.join(__dirname, 'tmp-gen-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, 'output.html');

    const result = createMinimalResult();
    generate(result, { outputPath, title: 'My Project Docs' });

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('My Project Docs');

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('generates self-contained file (no external dependencies)', () => {
    const tmpDir = path.join(__dirname, 'tmp-gen-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, 'output.html');

    const result = createMinimalResult();
    generate(result, { outputPath });

    const content = fs.readFileSync(outputPath, 'utf-8');
    
    // Should not have external script or link tags
    expect(content).not.toMatch(/<script\s+src=/);
    expect(content).not.toMatch(/<link\s+href=/);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('includes file tree in output', () => {
    const tmpDir = path.join(__dirname, 'tmp-gen-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, 'output.html');

    const result = createMinimalResult();
    generate(result, { outputPath });

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('fileTree');

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('includes graph data in output', () => {
    const tmpDir = path.join(__dirname, 'tmp-gen-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, 'output.html');

    const result = createMinimalResult();
    generate(result, { outputPath });

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('graphNodes');
    expect(content).toContain('graphEdges');

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('handles large codebases', () => {
    const tmpDir = path.join(__dirname, 'tmp-gen-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, 'output.html');

    // Create a result with many modules
    const modules: ModuleInfo[] = [];
    for (let i = 0; i < 100; i++) {
      modules.push({
        path: `src/module${i}.ts`,
        language: 'typescript',
        imports: [],
        exports: [{ name: `func${i}`, isDefault: false, isType: false, line: 1 }],
        symbols: [{ name: `func${i}`, kind: 'function', line: 1, endLine: 2, snippet: '' }],
        content: '',
      });
    }

    const result: AnalysisResult = {
      modules,
      dependencies: [],
      metrics: modules.map(m => ({
        path: m.path,
        symbolCount: 1,
        importCount: 0,
        exportCount: 1,
        dependencyCount: 0,
        dependentCount: 0,
      })),
      fileTree: [],
      summary: {
        totalFiles: 100,
        totalModules: 100,
        totalSymbols: 100,
        totalDependencies: 0,
        languages: { typescript: 100 },
      },
    };

    const output = generate(result, { outputPath });
    expect(fs.existsSync(output)).toBe(true);

    const content = fs.readFileSync(output, 'utf-8');
    expect(content).toContain('func0');
    expect(content).toContain('func99');

    fs.rmSync(tmpDir, { recursive: true });
  });
});
