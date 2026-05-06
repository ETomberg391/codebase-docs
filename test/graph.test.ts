import { describe, it, expect } from 'vitest';
import { buildGraph } from '../src/graph.js';
import type { ModuleInfo, ModuleMetrics, DependencyEdge } from '../src/types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('graph', () => {
  function createModule(path: string): ModuleInfo {
    return {
      path,
      language: 'typescript',
      imports: [],
      exports: [],
      symbols: [],
      content: '',
    };
  }

  function createMetrics(path: string, depCount: number = 0, dependentCount: number = 0): ModuleMetrics {
    return {
      path,
      symbolCount: 1,
      importCount: 1,
      exportCount: 1,
      dependencyCount: depCount,
      dependentCount,
    };
  }

  it('builds graph with nodes and edges', () => {
    const modules = [createModule('src/index.ts'), createModule('src/utils.ts')];
    const metrics = [createMetrics('src/index.ts', 1, 0), createMetrics('src/utils.ts', 0, 1)];
    const edges: DependencyEdge[] = [{ from: 'src/index.ts', to: 'src/utils.ts', importedSymbols: ['helper'] }];

    const graph = buildGraph(modules, edges, metrics);

    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(1);
    expect(graph.nodes[0].x).toBeDefined();
    expect(graph.nodes[0].y).toBeDefined();
  });

  it('computes layout positions', () => {
    const modules = [createModule('src/a.ts'), createModule('src/b.ts'), createModule('src/c.ts')];
    const metrics = modules.map(m => createMetrics(m.path));
    const edges: DependencyEdge[] = [
      { from: 'src/a.ts', to: 'src/b.ts', importedSymbols: [] },
      { from: 'src/b.ts', to: 'src/c.ts', importedSymbols: [] },
    ];

    const graph = buildGraph(modules, edges, metrics);

    // All nodes should have valid positions
    for (const node of graph.nodes) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.y).toBeGreaterThan(0);
    }
  });

  it('sets node radius based on connections', () => {
    const modules = [createModule('src/hub.ts'), createModule('src/leaf.ts')];
    const metrics = [
      createMetrics('src/hub.ts', 5, 3),  // 8 total connections
      createMetrics('src/leaf.ts', 0, 1), // 1 total connection
    ];
    const edges: DependencyEdge[] = [];

    const graph = buildGraph(modules, edges, metrics);

    const hub = graph.nodes.find(n => n.id === 'src/hub.ts');
    const leaf = graph.nodes.find(n => n.id === 'src/leaf.ts');

    expect(hub!.radius).toBeGreaterThan(leaf!.radius);
  });

  it('generates display labels', () => {
    const modules = [createModule('src/components/Button.tsx')];
    const metrics = [createMetrics('src/components/Button.tsx')];
    const edges: DependencyEdge[] = [];

    const graph = buildGraph(modules, edges, metrics);

    expect(graph.nodes[0].label).toContain('Button');
  });

  it('handles empty input', () => {
    const graph = buildGraph([], [], []);
    expect(graph.nodes.length).toBe(0);
    expect(graph.edges.length).toBe(0);
  });

  it('assigns colors by language', () => {
    const modules = [
      { ...createModule('src/app.ts'), language: 'typescript' },
      { ...createModule('src/app.py'), language: 'python' },
    ];
    const metrics = modules.map(m => createMetrics(m.path));
    const edges: DependencyEdge[] = [];

    const graph = buildGraph(modules, edges, metrics);

    const tsNode = graph.nodes.find(n => n.id === 'src/app.ts');
    const pyNode = graph.nodes.find(n => n.id === 'src/app.py');

    expect(tsNode!.color).toBe('#3178c6');
    expect(pyNode!.color).toBe('#3776ab');
  });
});
