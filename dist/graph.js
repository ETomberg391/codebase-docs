// Color palette for different languages
const LANGUAGE_COLORS = {
    typescript: '#3178c6',
    javascript: '#f7df1e',
    python: '#3776ab',
    go: '#00add8',
    rust: '#dea584',
    java: '#b07219',
    unknown: '#888888',
};
/**
 * Builds graph data from analysis results and computes layout positions
 * using a simple force-directed algorithm.
 */
export function buildGraph(modules, dependencies, metrics) {
    const metricsMap = new Map(metrics.map(m => [m.path, m]));
    const modulesMap = new Map(modules.map(m => [m.path, m]));
    // Build nodes
    const nodes = modules.map(mod => {
        const m = metricsMap.get(mod.path) || {
            path: mod.path,
            symbolCount: 0,
            importCount: 0,
            exportCount: 0,
            dependencyCount: 0,
            dependentCount: 0,
        };
        const totalConnections = m.dependencyCount + m.dependentCount;
        const radius = Math.max(8, Math.min(30, 8 + totalConnections * 2));
        // Get language from module
        const lang = mod.language;
        const color = LANGUAGE_COLORS[lang] || LANGUAGE_COLORS.unknown;
        return {
            id: mod.path,
            label: getDisplayLabel(mod.path),
            x: 0,
            y: 0,
            radius,
            color,
            metrics: m,
        };
    });
    // Build edges
    const edges = dependencies.map(d => ({
        from: d.from,
        to: d.to,
        symbols: d.importedSymbols,
    }));
    // Compute layout
    computeLayout(nodes, edges);
    return { nodes, edges };
}
function getDisplayLabel(path) {
    // Get just the filename without extension
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    const nameWithoutExt = filename.replace(/\.(ts|tsx|js|jsx|py|go|rs|java)$/, '');
    if (parts.length <= 2) {
        return nameWithoutExt;
    }
    // Include parent directory for context
    const parent = parts[parts.length - 2];
    return `${parent}/${nameWithoutExt}`;
}
/**
 * Simple force-directed layout algorithm.
 * Uses repulsion between nodes, attraction along edges, and centering force.
 */
function computeLayout(nodes, edges) {
    if (nodes.length === 0)
        return;
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;
    // Initialize positions randomly around center
    for (const node of nodes) {
        node.x = centerX + (Math.random() - 0.5) * width * 0.5;
        node.y = centerY + (Math.random() - 0.5) * height * 0.5;
    }
    // Build adjacency for quick lookup
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const edgeSet = new Set(edges.map(e => `${e.from}→${e.to}`));
    // Adaptive iteration count: fewer iterations for larger graphs
    const maxIterations = Math.max(50, Math.min(200, 400 - nodes.length));
    const repulsionStrength = 5000;
    const attractionStrength = 0.005;
    const centerGravity = 0.01;
    const damping = 0.9;
    const convergenceThreshold = 0.01; // Stop when max displacement drops below this
    // For large graphs, use spatial grid to optimize repulsion
    const useSpatialGrid = nodes.length > 100;
    const gridSize = useSpatialGrid ? Math.max(width, height) / 10 : 0;
    for (let iter = 0; iter < maxIterations; iter++) {
        const temperature = 1 - iter / maxIterations; // Cool down
        // Reset forces
        const forces = new Map();
        for (const node of nodes) {
            forces.set(node.id, { fx: 0, fy: 0 });
        }
        if (useSpatialGrid) {
            // Spatial grid-based repulsion for large graphs
            const grid = buildSpatialGrid(nodes, gridSize);
            for (const node of nodes) {
                const cell = getGridCell(node.x, node.y, gridSize, width, height);
                const neighbors = getGridNeighbors(grid, cell.row, cell.col);
                for (const other of neighbors) {
                    if (other.id === node.id)
                        continue;
                    const dx = other.x - node.x;
                    const dy = other.y - node.y;
                    const distSq = dx * dx + dy * dy + 1;
                    // Only compute repulsion for nearby nodes (within 2x grid cell)
                    if (distSq > gridSize * gridSize * 4)
                        continue;
                    const dist = Math.sqrt(distSq);
                    const force = repulsionStrength / distSq;
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    const f = forces.get(node.id);
                    f.fx -= fx;
                    f.fy -= fy;
                }
            }
        }
        else {
            // Full O(n²) repulsion for small graphs
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const a = nodes[i];
                    const b = nodes[j];
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const distSq = dx * dx + dy * dy + 1;
                    const dist = Math.sqrt(distSq);
                    const force = repulsionStrength / distSq;
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    const aForce = forces.get(a.id);
                    aForce.fx -= fx;
                    aForce.fy -= fy;
                    const bForce = forces.get(b.id);
                    bForce.fx += fx;
                    bForce.fy += fy;
                }
            }
        }
        // Attraction along edges
        for (const edge of edges) {
            const fromNode = nodeMap.get(edge.from);
            const toNode = nodeMap.get(edge.to);
            if (!fromNode || !toNode)
                continue;
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy) + 1;
            const force = dist * attractionStrength;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            const fromForce = forces.get(fromNode.id);
            if (fromForce) {
                fromForce.fx += fx;
                fromForce.fy += fy;
            }
            const toForce = forces.get(toNode.id);
            if (toForce) {
                toForce.fx -= fx;
                toForce.fy -= fy;
            }
        }
        // Center gravity
        for (const node of nodes) {
            const force = forces.get(node.id);
            force.fx += (centerX - node.x) * centerGravity;
            force.fy += (centerY - node.y) * centerGravity;
        }
        // Apply forces and track max displacement for early stopping
        let maxDisplacement = 0;
        for (const node of nodes) {
            const force = forces.get(node.id);
            const dx = force.fx * temperature * damping;
            const dy = force.fy * temperature * damping;
            node.x += dx;
            node.y += dy;
            // Keep within bounds
            node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
            node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));
            const displacement = Math.sqrt(dx * dx + dy * dy);
            if (displacement > maxDisplacement) {
                maxDisplacement = displacement;
            }
        }
        // Early stopping: if layout has converged
        if (maxDisplacement < convergenceThreshold && iter > 10) {
            break;
        }
    }
}
function buildSpatialGrid(nodes, gridSize) {
    const cols = Math.ceil(800 / gridSize);
    const rows = Math.ceil(600 / gridSize);
    const cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => []));
    for (const node of nodes) {
        const cell = getGridCell(node.x, node.y, gridSize, 800, 600);
        cells[cell.row][cell.col].push(node);
    }
    return { cells, rows, cols };
}
function getGridCell(x, y, gridSize, width, height) {
    const col = Math.min(Math.floor(x / gridSize), Math.ceil(width / gridSize) - 1);
    const row = Math.min(Math.floor(y / gridSize), Math.ceil(height / gridSize) - 1);
    return { row, col };
}
function getGridNeighbors(grid, row, col) {
    const result = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r < grid.rows && c >= 0 && c < grid.cols) {
                result.push(...grid.cells[r][c]);
            }
        }
    }
    return result;
}
//# sourceMappingURL=graph.js.map