import type { DependencyEdge, ModuleMetrics, ModuleInfo } from './types.js';
export interface GraphNode {
    id: string;
    label: string;
    x: number;
    y: number;
    radius: number;
    color: string;
    metrics: ModuleMetrics;
}
export interface GraphEdge {
    from: string;
    to: string;
    symbols: string[];
}
export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}
/**
 * Builds graph data from analysis results and computes layout positions
 * using a simple force-directed algorithm.
 */
export declare function buildGraph(modules: ModuleInfo[], dependencies: DependencyEdge[], metrics: ModuleMetrics[]): GraphData;
//# sourceMappingURL=graph.d.ts.map