import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AnalysisResult, GeneratorOptions, ModuleInfo, TreeNode } from './types.js';
import type { GraphNode, GraphEdge } from './graph.js';
import { buildGraph } from './graph.js';

// Read version from package.json
const PKG_JSON = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
);
const VERSION = (PKG_JSON as { version: string }).version;

function stripContentFromTree(tree: TreeNode[]): TreeNode[] {
  return tree.map(node => {
    const stripped: TreeNode = {
      name: node.name,
      path: node.path,
      children: node.children ? stripContentFromTree(node.children) : [],
      isFile: node.isFile,
    };
    // Include module without content
    if (node.module) {
      stripped.module = {
        path: node.module.path,
        language: node.module.language,
        symbols: node.module.symbols,
        imports: node.module.imports,
        exports: node.module.exports,
      };
    }
    return stripped;
  });
}
export function generate(result: AnalysisResult, options: GeneratorOptions = {}): string {
  const outputPath = options.outputPath || 'docs.html';
  const title = options.title || 'Codebase Documentation';
  const theme = options.theme || 'dark';

  // Build graph data
  const graphData = buildGraph(result.modules, result.dependencies, result.metrics);

  // Strip source content from modules before embedding in HTML
  const modulesWithoutContent = result.modules.map(m => ({
    path: m.path,
    language: m.language,
    symbols: m.symbols,
    imports: m.imports,
    exports: m.exports,
  }));

  // Strip content from fileTree modules (recursive)
  const fileTreeWithoutContent = stripContentFromTree(result.fileTree);

  // Generate the HTML
  const html = buildHtml(title, { ...result, modules: modulesWithoutContent, fileTree: fileTreeWithoutContent }, graphData, theme);

  // Write to file
  const resolvedPath = path.resolve(outputPath);
  fs.writeFileSync(resolvedPath, html, 'utf-8');

  return resolvedPath;
}

function buildHtml(
  title: string,
  result: AnalysisResult,
  graphData: { nodes: GraphNode[]; edges: GraphEdge[] },
  theme: 'dark' | 'light',
): string {
  const jsonModules = escapeJson(JSON.stringify(result.modules));
  const jsonTree = escapeJson(JSON.stringify(result.fileTree));
  const jsonSummary = escapeJson(JSON.stringify(result.summary));
  const jsonGraphNodes = escapeJson(JSON.stringify(graphData.nodes));
  const jsonGraphEdges = escapeJson(JSON.stringify(graphData.edges));
  const jsonMetrics = escapeJson(JSON.stringify(result.metrics));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
${getStyles(theme)}
</style>
</head>
<body>
<div id="app">
  <header class="header">
    <div class="header-left">
      <h1 class="logo">📊 Codebase Docs</h1>
      <div class="summary-badges">
        <span class="badge" title="Total files">${result.summary.totalFiles} files</span>
        <span class="badge" title="Modules">${result.summary.totalModules} modules</span>
        <span class="badge" title="Symbols">${result.summary.totalSymbols} symbols</span>
        <span class="badge" title="Dependencies">${result.summary.totalDependencies} deps</span>
      </div>
    </div>
    <div class="header-right">
      <div class="search-box">
        <input type="text" id="search" placeholder="Search symbols, files..." autocomplete="off">
        <div id="search-results" class="search-results"></div>
      </div>
    </div>
  </header>

  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>File Tree</h2>
      </div>
      <nav id="file-tree" class="file-tree">
      </nav>
    </aside>

    <main class="main-content">
      <div class="tabs">
        <button class="tab active" data-tab="modules">Modules</button>
        <button class="tab" data-tab="graph">Dependency Graph</button>
        <button class="tab" data-tab="overview">Overview</button>
      </div>

      <div id="tab-modules" class="tab-content active">
        <div id="modules-list" class="modules-list">
        </div>
      </div>

      <div id="tab-graph" class="tab-content">
        <div class="graph-controls">
          <button id="reset-graph">Reset View</button>
          <span id="graph-hint">Scroll to zoom, drag to pan, click nodes for details</span>
        </div>
        <canvas id="graph-canvas" class="graph-canvas"></canvas>
        <div id="graph-tooltip" class="graph-tooltip"></div>
      </div>

      <div id="tab-overview" class="tab-content">
        <div class="overview">
          <h2>Architecture Overview</h2>
          <div class="overview-grid">
            <div class="overview-card">
              <h3>Language Distribution</h3>
              <div id="language-chart"></div>
            </div>
            <div class="overview-card">
              <h3>Module Statistics</h3>
              <div id="module-stats"></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <div id="code-modal" class="modal">
    <div class="modal-content">
      <button class="modal-close">&times;</button>
      <h3 id="modal-title"></h3>
      <div id="modal-body"></div>
    </div>
  </div>
</div>
  <footer class="footer">
    <span>codebase-docs v${VERSION}</span>
    <span>Generated ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
  </footer>

<script>
// Embedded data
const DATA = {
  modules: ${jsonModules},
  fileTree: ${jsonTree},
  summary: ${jsonSummary},
  graphNodes: ${jsonGraphNodes},
  graphEdges: ${jsonGraphEdges},
  metrics: ${jsonMetrics},
};

${getJavaScript()}
</script>
</body>
</html>`;
}

function escapeJson(str: string): string {
  return str;
}

function getStyles(theme: 'dark' | 'light'): string {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0d1117' : '#ffffff';
  const bgSecondary = isDark ? '#161b22' : '#f6f8fa';
  const bgTertiary = isDark ? '#21262d' : '#eaeef2';
  const text = isDark ? '#c9d1d9' : '#24292f';
  const textMuted = isDark ? '#8b949e' : '#57606a';
  const border = isDark ? '#30363d' : '#d0d7de';
  const accent = '#58a6ff';
  const accentHover = '#79b8ff';
  const cardBg = isDark ? '#161b22' : '#ffffff';
  const cardBorder = isDark ? '#30363d' : '#d0d7de';
  const success = '#238636';
  const warning = '#d29922';

  return `
/* Reset and base */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: ${bg};
  color: ${text};
  line-height: 1.5;
  font-size: 14px;
  overflow: hidden;
  height: 100vh;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: ${bgSecondary};
  border-bottom: 1px solid ${border};
  height: 56px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  font-size: 18px;
  font-weight: 600;
  color: ${text};
}

.summary-badges {
  display: flex;
  gap: 8px;
}

.badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  background: ${bgTertiary};
  color: ${textMuted};
  border: 1px solid ${border};
}

.header-right {
  display: flex;
  align-items: center;
}

.search-box {
  position: relative;
  width: 300px;
}

.search-box input {
  width: 100%;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid ${border};
  background: ${bg};
  color: ${text};
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.search-box input:focus {
  border-color: ${accent};
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 400px;
  overflow-y: auto;
  background: ${cardBg};
  border: 1px solid ${border};
  border-radius: 6px;
  margin-top: 4px;
  display: none;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}

.search-results.visible {
  display: block;
}

.search-result-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid ${border};
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-result-item:hover {
  background: ${bgTertiary};
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-kind {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  background: ${bgTertiary};
  color: ${textMuted};
  text-transform: uppercase;
}

.search-result-name {
  font-weight: 500;
}

.search-result-path {
  font-size: 12px;
  color: ${textMuted};
}

/* Layout */
.layout {
  display: flex;
  height: calc(100vh - 56px - 32px);
}

/* Sidebar */
.sidebar {
  width: 280px;
  min-width: 280px;
  background: ${bgSecondary};
  border-right: 1px solid ${border};
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  padding: 12px 16px;
  border-bottom: 1px solid ${border};
}

.sidebar-header h2 {
  font-size: 14px;
  font-weight: 600;
  color: ${textMuted};
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.file-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.tree-item {
  cursor: pointer;
  user-select: none;
}

.tree-row {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  gap: 4px;
  font-size: 13px;
}

.tree-row:hover {
  background: ${bgTertiary};
}

.tree-row.active {
  background: ${bgTertiary};
  color: ${accent};
}

.tree-toggle {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: ${textMuted};
  transition: transform 0.15s;
}

.tree-toggle.expanded {
  transform: rotate(90deg);
}

.tree-icon {
  margin-right: 4px;
  font-size: 14px;
}

.tree-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-children {
  padding-left: 16px;
}

/* Main content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 0;
  background: ${bgSecondary};
  border-bottom: 1px solid ${border};
  padding: 0 16px;
}

.tab {
  padding: 10px 16px;
  background: none;
  border: none;
  color: ${textMuted};
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.tab:hover {
  color: ${text};
}

.tab.active {
  color: ${accent};
  border-bottom-color: ${accent};
}

.tab-content {
  display: none;
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.tab-content.active {
  display: block;
}

/* Module cards */
.modules-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.module-card {
  background: ${cardBg};
  border: 1px solid ${cardBorder};
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.module-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.module-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  gap: 12px;
}

.module-path {
  flex: 1;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  color: ${accent};
}

.module-lang {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${bgTertiary};
  color: ${textMuted};
  text-transform: uppercase;
}

.module-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: ${textMuted};
}

.module-body {
  display: none;
  padding: 0 16px 16px;
  border-top: 1px solid ${border};
}

.module-body.expanded {
  display: block;
}

.module-section {
  margin-top: 12px;
}

.module-section h4 {
  font-size: 12px;
  color: ${textMuted};
  text-transform: uppercase;
  margin-bottom: 8px;
}

.symbol-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.symbol-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: ${bgTertiary};
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.symbol-chip:hover {
  background: ${border};
}

.symbol-chip .kind {
  font-size: 10px;
  color: ${textMuted};
  text-transform: uppercase;
}

.dep-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dep-chip {
  padding: 4px 8px;
  background: ${bgTertiary};
  border-radius: 4px;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  cursor: pointer;
  transition: background 0.15s;
}

.dep-chip:hover {
  background: ${border};
}

/* Graph */
.graph-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.graph-controls button {
  padding: 6px 12px;
  background: ${bgTertiary};
  border: 1px solid ${border};
  border-radius: 6px;
  color: ${text};
  cursor: pointer;
  font-size: 12px;
}

.graph-controls button:hover {
  background: ${border};
}

#graph-hint {
  font-size: 12px;
  color: ${textMuted};
}

.graph-canvas {
  width: 100%;
  height: 600px;
  border: 1px solid ${border};
  border-radius: 8px;
  background: ${bgSecondary};
  cursor: grab;
}

.graph-canvas:active {
  cursor: grabbing;
}

.graph-tooltip {
  position: absolute;
  display: none;
  padding: 12px;
  background: ${cardBg};
  border: 1px solid ${border};
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  max-width: 300px;
  z-index: 50;
  pointer-events: none;
}

.graph-tooltip.visible {
  display: block;
}

/* Overview */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.overview-card {
  background: ${cardBg};
  border: 1px solid ${cardBorder};
  border-radius: 8px;
  padding: 16px;
}

.overview-card h3 {
  font-size: 14px;
  margin-bottom: 12px;
  color: ${textMuted};
}

.lang-bar {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
}

.lang-bar-label {
  width: 80px;
  font-size: 12px;
  text-transform: capitalize;
}

.lang-bar-track {
  flex: 1;
  height: 20px;
  background: ${bgTertiary};
  border-radius: 4px;
  overflow: hidden;
}

.lang-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.lang-bar-count {
  width: 40px;
  text-align: right;
  font-size: 12px;
  color: ${textMuted};
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid ${border};
  font-size: 13px;
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-label {
  color: ${textMuted};
}

.stat-value {
  font-weight: 500;
}

/* Modal */
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.6);
  z-index: 200;
  align-items: center;
  justify-content: center;
}

.modal.visible {
  display: flex;
}

.modal-content {
  background: ${cardBg};
  border: 1px solid ${border};
  border-radius: 12px;
  max-width: 800px;
  max-height: 80vh;
  width: 90%;
  overflow: auto;
  padding: 24px;
  position: relative;
}

.modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  font-size: 24px;
  color: ${textMuted};
  cursor: pointer;
}

.modal-close:hover {
  color: ${text};
}

#modal-title {
  margin-bottom: 12px;
  padding-right: 40px;
}

#modal-body pre {
  background: ${bgSecondary};
  border: 1px solid ${border};
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.6;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: ${border};
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: ${textMuted};
}

/* No results */
.no-results {
  text-align: center;
  padding: 40px;
  color: ${textMuted};
}

.no-results h3 {
  margin-bottom: 8px;
}

/* Footer */
.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  background: ${bgSecondary};
  border-top: 1px solid ${border};
  font-size: 11px;
  color: ${textMuted};
}

.footer span {
  margin-right: 16px;
}
`;
}

function getJavaScript(): string {
  return `
// ===== State =====
let currentTab = 'modules';
let searchTerm = '';
let graphState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  dragOffsetX: 0,
  dragOffsetY: 0,
  hoveredNode: null,
};

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
  renderFileTree(DATA.fileTree);
  renderModules();
  renderOverview();
  initGraph();
  initSearch();
  initTabs();
  initModal();
});

// ===== File Tree =====
function renderFileTree(tree) {
  const container = document.getElementById('file-tree');
  container.innerHTML = renderTreeNode(tree, 0);
  
  // Add click handlers
  container.querySelectorAll('.tree-toggle').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const children = el.parentElement.parentElement.querySelector('.tree-children');
      if (children) {
        const isExpanded = el.classList.contains('expanded');
        el.classList.toggle('expanded');
        children.style.display = isExpanded ? 'none' : 'block';
      }
    });
    
    container.querySelectorAll('.tree-row[data-module]').forEach(el => {
      el.addEventListener('click', () => {
        const modulePath = el.getAttribute('data-module');
        showModuleDetail(modulePath);
      });
    });
  });
}

function renderTreeNode(nodes, depth) {
  if (!Array.isArray(nodes)) return '';
  
  let html = '';
  for (const node of nodes) {
    if (node.isFile) {
      const hasModule = node.module && (node.module.symbols.length > 0 || node.module.exports.length > 0);
      const icon = getFileIcon(node.name);
      html += '<div class="tree-item">' +
        '<div class="tree-row' + (hasModule ? '" data-module="' + node.path + '' : '">') +
        '<span class="tree-toggle" style="visibility:hidden">▶</span>' +
        '<span class="tree-icon">' + icon + '</span>' +
        '<span class="tree-name">' + escapeHtml(node.name) + '</span>' +
        '</div></div>';
    } else {
      const hasChildren = node.children && node.children.length > 0;
      html += '<div class="tree-item">' +
        '<div class="tree-row">' +
        '<span class="tree-toggle' + (depth === 0 ? ' expanded' : '') + '">▶</span>' +
        '<span class="tree-icon">📁</span>' +
        '<span class="tree-name">' + escapeHtml(node.name) + '</span>' +
        '</div>';
      if (hasChildren) {
        html += '<div class="tree-children" style="display:' + (depth === 0 ? 'block' : 'none') + '">' +
          renderTreeNode(node.children, depth + 1) +
          '</div>';
      }
      html += '</div>';
    }
  }
  return html;
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    ts: '🔷', tsx: '🔷', js: '📜', jsx: '📜',
    py: '🐍', go: '🔵', rs: '🦀', java: '☕',
    md: '📝', json: '📋', yaml: '📋', yml: '📋',
  };
  return icons[ext] || '📄';
}

function showModuleDetail(modulePath) {
  const module = DATA.modules.find(m => m.path === modulePath);
  if (!module) return;
  
  // Switch to modules tab and scroll to the card
  switchTab('modules');
  const card = document.querySelector('.module-card[data-path="' + modulePath + '"]');
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const body = card.querySelector('.module-body');
    if (body) {
      body.classList.toggle('expanded');
      const toggle = card.querySelector('.module-header');
      const arrow = toggle.querySelector('.arrow');
      if (arrow) arrow.classList.toggle('expanded');
    }
  }
}

// ===== Modules =====
function renderModules() {
  const container = document.getElementById('modules-list');
  
  // Sort modules by path
  const sorted = [...DATA.modules].sort((a, b) => a.path.localeCompare(b.path));
  
  if (sorted.length === 0) {
    container.innerHTML = '<div class="no-results"><h3>No modules found</h3></div>';
    return;
  }
  
  let html = '';
  for (const mod of sorted) {
    const metrics = DATA.metrics.find(m => m.path === mod.path) || {};
    
    html += '<div class="module-card" data-path="' + escapeHtml(mod.path) + '">' +
      '<div class="module-header" onclick="this.nextElementSibling.classList.toggle(\\'expanded\\'); this.querySelector(\\'.arrow\\').classList.toggle(\\'expanded\\')">' +
      '<span class="arrow" style="margin-right:8px;font-size:10px">▶</span>' +
      '<span class="module-path">' + escapeHtml(mod.path) + '</span>' +
      '<span class="module-lang">' + escapeHtml(mod.language) + '</span>' +
      '<div class="module-stats">' +
      '<span>' + mod.symbols.length + ' symbols</span>' +
      '<span>' + (metrics.dependencyCount || 0) + ' deps</span>' +
      '<span>' + (metrics.dependentCount || 0) + ' dependents</span>' +
      '</div>' +
      '</div>' +
      '<div class="module-body">';
    
    // Symbols
    if (mod.symbols.length > 0) {
      html += '<div class="module-section"><h4>Symbols</h4><div class="symbol-list">';
      for (const sym of mod.symbols) {
        html += '<span class="symbol-chip" onclick="showCodeSnippet(\\'' + escapeHtml(mod.path) + '\\', ' + sym.line + ')">' +
          '<span class="kind">' + escapeHtml(sym.kind) + '</span>' +
          '<span>' + escapeHtml(sym.name) + '</span>' +
          '</span>';
      }
      html += '</div></div>';
    }
    
    // Dependencies
    const deps = DATA.graphEdges.filter(e => e.from === mod.path);
    if (deps.length > 0) {
      html += '<div class="module-section"><h4>Dependencies</h4><div class="dep-list">';
      for (const dep of deps) {
        const shortPath = dep.to.split('/').slice(-2).join('/');
        html += '<span class="dep-chip" onclick="showModuleDetail(\\'' + escapeHtml(dep.to) + '\\')">' +
          escapeHtml(shortPath) + '</span>';
      }
      html += '</div></div>';
    }
    
    // Dependents
    const dependents = DATA.graphEdges.filter(e => e.to === mod.path);
    if (dependents.length > 0) {
      html += '<div class="module-section"><h4>Dependents</h4><div class="dep-list">';
      for (const dep of dependents) {
        const shortPath = dep.from.split('/').slice(-2).join('/');
        html += '<span class="dep-chip" onclick="showModuleDetail(\\'' + escapeHtml(dep.from) + '\\')">' +
          escapeHtml(shortPath) + '</span>';
      }
      html += '</div></div>';
    }
    
    html += '</div></div>';
  }
  
  container.innerHTML = html;
  
  // Add arrow click handler
  container.querySelectorAll('.module-header .arrow').forEach(arrow => {
    arrow.classList.add('style-arrow');
  });
}

function showCodeSnippet(modulePath, lineNum) {
  const module = DATA.modules.find(m => m.path === modulePath);
  if (!module) return;
  
  const symbol = module.symbols.find(s => s.line === lineNum);
  if (!symbol) return;
  
  const modal = document.getElementById('code-modal');
  document.getElementById('modal-title').textContent = symbol.name + ' (' + symbol.kind + ')';
  
  let body = '<p style="color:#8b949e;margin-bottom:12px">' + escapeHtml(modulePath) + ':L' + lineNum + '</p>';
  
  if (symbol.docComment) {
    body += '<p style="margin-bottom:12px;font-style:italic;color:#8b949e">' + escapeHtml(symbol.docComment) + '</p>';
  }
  
  body += '<pre><code>' + escapeHtml(symbol.snippet) + '</code></pre>';
  
  document.getElementById('modal-body').innerHTML = body;
  modal.classList.add('visible');
}

// ===== Search =====
function initSearch() {
  const input = document.getElementById('search');
  const results = document.getElementById('search-results');
  
  input.addEventListener('input', () => {
    const term = input.value.trim().toLowerCase();
    if (!term) {
      results.classList.remove('visible');
      return;
    }
    
    const matches = [];
    
    for (const mod of DATA.modules) {
      for (const sym of mod.symbols) {
        if (sym.name.toLowerCase().includes(term) || mod.path.toLowerCase().includes(term)) {
          matches.push({ module: mod, symbol: sym });
          if (matches.length >= 50) break;
        }
      }
      if (matches.length >= 50) break;
    }
    
    if (matches.length === 0) {
      results.innerHTML = '<div class="search-result-item"><span style="color:#8b949e">No results</span></div>';
      results.classList.add('visible');
      return;
    }
    
    let html = '';
    for (const match of matches) {
      html += '<div class="search-result-item" onclick="showCodeSnippet(\\'' + 
        escapeHtml(match.module.path) + '\\', ' + match.symbol.line + '); document.getElementById(\\'search-results\\').classList.remove(\\'visible\\');">' +
        '<span class="search-result-kind">' + escapeHtml(match.symbol.kind) + '</span>' +
        '<span class="search-result-name">' + escapeHtml(match.symbol.name) + '</span>' +
        '<span class="search-result-path">' + escapeHtml(match.module.path) + '</span>' +
        '</div>';
    }
    
    results.innerHTML = html;
    results.classList.add('visible');
  });
  
  // Close results on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      results.classList.remove('visible');
    }
  });
}

// ===== Tabs =====
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.getAttribute('data-tab'));
    });
  });
}

function switchTab(tabName) {
  currentTab = tabName;
  
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
  });
  
  document.querySelectorAll('.tab-content').forEach(tc => {
    tc.classList.toggle('active', tc.id === 'tab-' + tabName);
  });
  
  // Redraw graph when switching to graph tab
  if (tabName === 'graph') {
    drawGraph();
  }
}

// ===== Modal =====
function initModal() {
  const modal = document.getElementById('code-modal');
  const closeBtn = modal.querySelector('.modal-close');
  
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('visible');
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('visible');
    }
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      modal.classList.remove('visible');
    }
  });
}

// ===== Graph =====
function initGraph() {
  const canvas = document.getElementById('graph-canvas');
  const ctx = canvas.getContext('2d');
  
  // Set canvas size
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    drawGraph();
  }
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Pan and zoom
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking on a node
    const node = getNodeAt(x, y);
    if (node) {
      showGraphTooltip(node, e.clientX, e.clientY);
      return;
    }
    
    graphState.isDragging = true;
    graphState.dragStartX = e.clientX;
    graphState.dragStartY = e.clientY;
    graphState.dragOffsetX = graphState.offsetX;
    graphState.dragOffsetY = graphState.offsetY;
  });
  
  canvas.addEventListener('mousemove', (e) => {
    if (graphState.isDragging) {
      graphState.offsetX = graphState.dragOffsetX + (e.clientX - graphState.dragStartX);
      graphState.offsetY = graphState.dragOffsetY + (e.clientY - graphState.dragStartY);
      drawGraph();
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const node = getNodeAt(x, y);
    if (node) {
      canvas.style.cursor = 'pointer';
      showGraphTooltip(node, e.clientX, e.clientY);
    } else {
      canvas.style.cursor = 'grab';
      hideGraphTooltip();
    }
  });
  
  canvas.addEventListener('mouseup', () => {
    graphState.isDragging = false;
  });
  
  canvas.addEventListener('mouseleave', () => {
    graphState.isDragging = false;
    hideGraphTooltip();
  });
  
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    graphState.scale = Math.max(0.1, Math.min(5, graphState.scale * zoomFactor));
    drawGraph();
  });
  
  document.getElementById('reset-graph').addEventListener('click', () => {
    graphState.scale = 1;
    graphState.offsetX = 0;
    graphState.offsetY = 0;
    drawGraph();
  });
}

function drawGraph() {
  const canvas = document.getElementById('graph-canvas');
  const ctx = canvas.getContext('2d');
  const width = canvas.width / window.devicePixelRatio;
  const height = canvas.height / window.devicePixelRatio;
  
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(graphState.offsetX, graphState.offsetY);
  ctx.scale(graphState.scale, graphState.scale);
  
  // Draw edges
  for (const edge of DATA.graphEdges) {
    const fromNode = DATA.graphNodes.find(n => n.id === edge.from);
    const toNode = DATA.graphNodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) continue;
    
    ctx.beginPath();
    ctx.moveTo(fromNode.x, fromNode.y);
    ctx.lineTo(toNode.x, toNode.y);
    ctx.strokeStyle = 'rgba(139, 148, 158, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  
  // Draw nodes
  for (const node of DATA.graphNodes) {
    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Node label
    ctx.fillStyle = '#c9d1d9';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(node.label, node.x, node.y + node.radius + 14);
  }
  
  ctx.restore();
}

function getNodeAt(x, y) {
  const mx = (x - graphState.offsetX) / graphState.scale;
  const my = (y - graphState.offsetY) / graphState.scale;
  
  for (const node of DATA.graphNodes) {
    const dx = mx - node.x;
    const dy = my - node.y;
    if (dx * dx + dy * dy <= node.radius * node.radius) {
      return node;
    }
  }
  return null;
}

function showGraphTooltip(node, clientX, clientY) {
  const tooltip = document.getElementById('graph-tooltip');
  tooltip.innerHTML = '<strong>' + escapeHtml(node.label) + '</strong><br>' +
    '<span style="color:#8b949e;font-size:12px">' + escapeHtml(node.id) + '</span><br>' +
    '<span style="font-size:12px">Symbols: ' + node.metrics.symbolCount + 
    ' | Deps: ' + node.metrics.dependencyCount + 
    ' | Dependents: ' + node.metrics.dependentCount + '</span>';
  tooltip.style.left = (clientX + 10) + 'px';
  tooltip.style.top = (clientY + 10) + 'px';
  tooltip.classList.add('visible');
}

function hideGraphTooltip() {
  document.getElementById('graph-tooltip').classList.remove('visible');
}

// ===== Overview =====
function renderOverview() {
  renderLanguageChart();
  renderModuleStats();
}

function renderLanguageChart() {
  const container = document.getElementById('language-chart');
  const langs = DATA.summary.languages;
  const total = DATA.summary.totalFiles;
  
  const colors = {
    typescript: '#3178c6', javascript: '#f7df1e', python: '#3776ab',
    go: '#00add8', rust: '#dea584', java: '#b07219', unknown: '#888'
  };
  
  let html = '';
  for (const [lang, count] of Object.entries(langs)) {
    const pct = (count / total * 100).toFixed(1);
    html += '<div class="lang-bar">' +
      '<span class="lang-bar-label">' + escapeHtml(lang) + '</span>' +
      '<div class="lang-bar-track">' +
      '<div class="lang-bar-fill" style="width:' + pct + '%;background:' + (colors[lang] || '#888') + '"></div>' +
      '</div>' +
      '<span class="lang-bar-count">' + count + '</span>' +
      '</div>';
  }
  
  container.innerHTML = html;
}

function renderModuleStats() {
  const container = document.getElementById('module-stats');
  
  const totalSymbols = DATA.modules.reduce((sum, m) => sum + m.symbols.length, 0);
  const totalImports = DATA.modules.reduce((sum, m) => sum + m.imports.length, 0);
  const totalExports = DATA.modules.reduce((sum, m) => sum + m.exports.length, 0);
  
  // Find most connected modules
  const sorted = [...DATA.metrics].sort((a, b) => (b.dependencyCount + b.dependentCount) - (a.dependencyCount + a.dependentCount));
  const topConnected = sorted.slice(0, 5);
  
  let html = '<div class="stat-row"><span class="stat-label">Total symbols</span><span class="stat-value">' + totalSymbols + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Total imports</span><span class="stat-value">' + totalImports + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Total exports</span><span class="stat-value">' + totalExports + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Total dependencies</span><span class="stat-value">' + DATA.summary.totalDependencies + '</span></div>';
  
  if (topConnected.length > 0) {
    html += '<div style="margin-top:12px;color:#8b949e;font-size:12px;text-transform:uppercase">Most connected modules</div>';
    for (const m of topConnected) {
      const connections = m.dependencyCount + m.dependentCount;
      html += '<div class="stat-row"><span class="stat-label" style="font-family:monospace;font-size:12px">' + 
        escapeHtml(m.path.split('/').slice(-2).join('/')) + '</span>' +
        '<span class="stat-value">' + connections + '</span></div>';
    }
  }
  
  container.innerHTML = html;
}

// ===== Utilities =====
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
`;
}
