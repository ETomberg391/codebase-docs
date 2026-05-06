import type { CodeFile, SymbolInfo, ImportInfo, ExportInfo, ModuleInfo } from '../types.js';

/**
 * Parser for TypeScript and JavaScript files.
 * Extracts symbols, imports, and exports using regex-based parsing.
 */
export function parse(file: CodeFile): ModuleInfo {
  const lines = file.content.split('\n');
  const symbols: SymbolInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];

  // Track which symbols have already been added (to avoid duplicates)
  const seenSymbols = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Parse imports
    parseImport(line, lineNum, imports);

    // Parse exports
    parseExport(line, lineNum, exports);

    // Parse symbols
    parseSymbol(line, i, lines, seenSymbols, symbols);
  }

  // Merge exported symbols into the symbols list with their export info
  mergeExportedSymbols(symbols, exports);

  return {
    path: file.path,
    language: file.language,
    symbols,
    imports,
    exports,
    content: file.content,
  };
}

function parseImport(line: string, lineNum: number, imports: ImportInfo[]): void {
  // Match: import ... from '...'
  const fromMatch = line.match(/import\s+(.+)\s+from\s+['"](.+?)['"]/);
  if (fromMatch) {
    const importClause = fromMatch[1];
    const source = fromMatch[2];
    
    const importedNames: string[] = [];
    let isDefault = false;
    let isTypeOnly = false;

    // Check for type-only import
    if (importClause.startsWith('type ') || line.startsWith('import type')) {
      isTypeOnly = true;
    }

    // Parse import clause
    if (importClause.startsWith('{')) {
      // Named imports: import { a, b, c } from '...'
      const names = importClause
        .replace(/[{}]/g, '')
        .split(',')
        .map(n => n.trim().split(/\s+as\s+/).pop()?.trim() || '')
        .filter(n => n && !n.startsWith('type '));
      importedNames.push(...names);
    } else if (importClause === '*' || importClause.startsWith('type *')) {
      // Namespace import: import * as ns from '...'
      const nsMatch = importClause.match(/\*\s+as\s+(\w+)/);
      if (nsMatch) {
        importedNames.push(nsMatch[1]);
      }
    } else if (importClause.match(/^\w+/)) {
      // Default import: import Default from '...' or import Default, { named } from '...'
      const defaultMatch = importClause.match(/^(\w+)/);
      if (defaultMatch) {
        isDefault = true;
        importedNames.push(defaultMatch[1]);
      }
      // Also check for named imports after default
      const namedMatch = importClause.match(/\{([^}]+)\}/);
      if (namedMatch) {
        const names = namedMatch[1]
          .split(',')
          .map(n => n.trim().split(/\s+as\s+/).pop()?.trim() || '')
          .filter(n => n);
        importedNames.push(...names);
      }
    }

    imports.push({
      source,
      importedNames,
      isDefault,
      isTypeOnly,
      line: lineNum,
    });
  }

  // Also handle dynamic imports: import('...')
  const dynamicMatch = line.match(/import\s*\(\s*['"](.+?)['"]\s*\)/);
  if (dynamicMatch) {
    imports.push({
      source: dynamicMatch[1],
      importedNames: [],
      isDefault: false,
      isTypeOnly: false,
      line: lineNum,
    });
  }
}

function parseExport(line: string, lineNum: number, exports: ExportInfo[]): void {
  // export { a, b, c }
  const namedExport = line.match(/export\s*\{([^}]*)\}/);
  if (namedExport) {
    const names = namedExport[1]
      .split(',')
      .map(n => n.trim().split(/\s+as\s+/).pop()?.trim() || '')
      .filter(n => n);
    for (const name of names) {
      exports.push({ name, isDefault: false, isType: false, line: lineNum });
    }
    return;
  }

  // export default ...
  if (line.match(/export\s+default\s/)) {
    exports.push({ name: 'default', isDefault: true, isType: false, line: lineNum });
    return;
  }

  // export class Name
  const classMatch = line.match(/export\s+(?:abstract\s+)?class\s+(\w+)/);
  if (classMatch) {
    exports.push({ name: classMatch[1], isDefault: false, isType: false, line: lineNum });
    return;
  }

  // export interface Name
  const interfaceMatch = line.match(/export\s+interface\s+(\w+)/);
  if (interfaceMatch) {
    exports.push({ name: interfaceMatch[1], isDefault: false, isType: true, line: lineNum });
    return;
  }

  // export type Name
  const typeMatch = line.match(/export\s+type\s+(\w+)/);
  if (typeMatch) {
    exports.push({ name: typeMatch[1], isDefault: false, isType: true, line: lineNum });
    return;
  }

  // export enum Name
  const enumMatch = line.match(/export\s+enum\s+(\w+)/);
  if (enumMatch) {
    exports.push({ name: enumMatch[1], isDefault: false, isType: false, line: lineNum });
    return;
  }

  // export function Name / export async function Name
  const funcMatch = line.match(/export\s+(?:async\s+)?function\s+(\w+)/);
  if (funcMatch) {
    exports.push({ name: funcMatch[1], isDefault: false, isType: false, line: lineNum });
    return;
  }

  // export const/let/var Name
  const varMatch = line.match(/export\s+(const|let|var)\s+(\w+)/);
  if (varMatch) {
    exports.push({ name: varMatch[2], isDefault: false, isType: false, line: lineNum });
    return;
  }

  // export namespace Name
  const nsMatch = line.match(/export\s+namespace\s+(\w+)/);
  if (nsMatch) {
    exports.push({ name: nsMatch[1], isDefault: false, isType: false, line: lineNum });
    return;
  }

  // export * from '...' (re-export)
  const reexportMatch = line.match(/export\s+\*\s+from\s+['"](.+?)['"]/);
  if (reexportMatch) {
    // Re-exports don't add named exports, but we track them as a module-level export
    return;
  }
}

function parseSymbol(
  line: string,
  lineIdx: number,
  lines: string[],
  seenSymbols: Set<string>,
  symbols: SymbolInfo[],
): void {
  const lineNum = lineIdx + 1;

  // Skip import lines (exports are handled by regex patterns below)
  if (line.trim().startsWith('import ')) {
    return;
  }

  // class Name
  const classMatch = line.match(/^(?:\s*)(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
  if (classMatch) {
    const name = classMatch[1];
    if (!seenSymbols.has(`class:${name}`)) {
      seenSymbols.add(`class:${name}`);
      const endLine = findBlockEnd(lines, lineIdx);
      symbols.push({
        name,
        kind: 'class',
        line: lineNum,
        endLine,
        snippet: getSnippet(lines, lineIdx, endLine),
        docComment: extractDocComment(lines, lineIdx),
      });
    }
    return;
  }

  // interface Name
  const interfaceMatch = line.match(/^(?:\s*)(?:export\s+)?interface\s+(\w+)/);
  if (interfaceMatch) {
    const name = interfaceMatch[1];
    if (!seenSymbols.has(`interface:${name}`)) {
      seenSymbols.add(`interface:${name}`);
      const endLine = findBlockEnd(lines, lineIdx);
      symbols.push({
        name,
        kind: 'interface',
        line: lineNum,
        endLine,
        snippet: getSnippet(lines, lineIdx, endLine),
        docComment: extractDocComment(lines, lineIdx),
      });
    }
    return;
  }

  // type Name
  const typeMatch = line.match(/^(?:\s*)(?:export\s+)?type\s+(\w+)/);
  if (typeMatch) {
    const name = typeMatch[1];
    if (!seenSymbols.has(`type:${name}`)) {
      seenSymbols.add(`type:${name}`);
      const endLine = findAssignmentEnd(lines, lineIdx);
      symbols.push({
        name,
        kind: 'type',
        line: lineNum,
        endLine,
        snippet: getSnippet(lines, lineIdx, endLine),
        docComment: extractDocComment(lines, lineIdx),
      });
    }
    return;
  }

  // enum Name
  const enumMatch = line.match(/^(?:\s*)(?:export\s+)?enum\s+(\w+)/);
  if (enumMatch) {
    const name = enumMatch[1];
    if (!seenSymbols.has(`enum:${name}`)) {
      seenSymbols.add(`enum:${name}`);
      const endLine = findBlockEnd(lines, lineIdx);
      symbols.push({
        name,
        kind: 'enum',
        line: lineNum,
        endLine,
        snippet: getSnippet(lines, lineIdx, endLine),
        docComment: extractDocComment(lines, lineIdx),
      });
    }
    return;
  }

  // function Name / async function Name
  const funcMatch = line.match(/^(?:\s*)(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
  if (funcMatch) {
    const name = funcMatch[1];
    if (!seenSymbols.has(`function:${name}`)) {
      seenSymbols.add(`function:${name}`);
      const endLine = findBlockEnd(lines, lineIdx);
      symbols.push({
        name,
        kind: 'function',
        line: lineNum,
        endLine,
        snippet: getSnippet(lines, lineIdx, endLine),
        docComment: extractDocComment(lines, lineIdx),
      });
    }
    return;
  }

  // const/let/var Name = ...
  const varMatch = line.match(/^(?:\s*)(?:export\s+)?(const|let|var)\s+(\w+)/);
  if (varMatch) {
    const name = varMatch[2];
    if (!seenSymbols.has(`variable:${name}`)) {
      seenSymbols.add(`variable:${name}`);
      const kind = varMatch[1] === 'const' ? 'constant' : 'variable';
      const endLine = findAssignmentEnd(lines, lineIdx);
      symbols.push({
        name,
        kind,
        line: lineNum,
        endLine,
        snippet: getSnippet(lines, lineIdx, endLine),
        docComment: extractDocComment(lines, lineIdx),
      });
    }
    return;
  }

  // namespace Name
  const nsMatch = line.match(/^(?:\s*)(?:export\s+)?namespace\s+(\w+)/);
  if (nsMatch) {
    const name = nsMatch[1];
    if (!seenSymbols.has(`namespace:${name}`)) {
      seenSymbols.add(`namespace:${name}`);
      const endLine = findBlockEnd(lines, lineIdx);
      symbols.push({
        name,
        kind: 'namespace',
        line: lineNum,
        endLine,
        snippet: getSnippet(lines, lineIdx, endLine),
        docComment: extractDocComment(lines, lineIdx),
      });
    }
    return;
  }
}

function findBlockEnd(lines: string[], startIdx: number): number {
  let braceCount = 0;
  let started = false;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') {
        braceCount++;
        started = true;
      } else if (ch === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          return i + 1; // 1-indexed
        }
      }
    }
  }

  return startIdx + 1; // 1-indexed
}

function findAssignmentEnd(lines: string[], startIdx: number): number {
  // For single-line declarations (const x = value;)
  const line = lines[startIdx];
  if (line.includes(';')) {
    return startIdx + 1; // 1-indexed
  }

  // For multi-line assignments (arrow functions, object literals)
  let braceCount = 0;
  let parenCount = 0;
  let started = false;

  for (let i = startIdx; i < lines.length; i++) {
    const currentLine = lines[i];
    for (const ch of currentLine) {
      if (ch === '{') { braceCount++; started = true; }
      else if (ch === '}') { braceCount--; }
      else if (ch === '(') { parenCount++; started = true; }
      else if (ch === ')') { parenCount--; }
    }
    if (started && braceCount === 0 && parenCount === 0) {
      // Check if line ends with semicolon or closing brace
      const trimmed = currentLine.trim();
      if (trimmed.endsWith(';') || trimmed.endsWith('}')) {
        return i + 1; // 1-indexed
      }
      // If next line is empty or starts a new declaration, stop here
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (!nextLine || nextLine.match(/^(export\s+)?(const|let|var|function|class|interface|type|enum|namespace)\s/)) {
          return i + 1;
        }
      }
    }
  }

  return startIdx + 1;
}

function getSnippet(lines: string[], startIdx: number, endLine: number): string {
  // endLine is 1-indexed, convert to 0-indexed
  const endIdx = Math.min(endLine, lines.length);
  const maxLines = 20; // Limit snippet length
  const actualEnd = Math.min(endIdx, startIdx + maxLines);
  
  const snippetLines = lines.slice(startIdx, actualEnd);
  
  // Trim trailing empty lines
  while (snippetLines.length > 1 && !snippetLines[snippetLines.length - 1].trim()) {
    snippetLines.pop();
  }

  return snippetLines.join('\n');
}

function extractDocComment(lines: string[], lineIdx: number): string | undefined {
  // Look backwards for JSDoc comment
  let prevIdx = lineIdx - 1;
  if (prevIdx < 0) return undefined;

  // Check if previous line ends with */
  const prevLine = lines[prevIdx].trim();
  if (!prevLine.endsWith('*/')) return undefined;

  // Collect the JSDoc block
  const docLines: string[] = [];
  while (prevIdx >= 0) {
    const line = lines[prevIdx].trim();
    docLines.unshift(line);
    if (line.startsWith('/**')) break;
    prevIdx--;
  }

  // Clean up JSDoc markers
  const cleaned = docLines
    .map(line => line.replace(/^\/\*\*\s?/, '').replace(/\*\//, '').replace(/^\*\s?/, ''))
    .join('\n')
    .trim();

  return cleaned || undefined;
}

function mergeExportedSymbols(symbols: SymbolInfo[], exports: ExportInfo[]): void {
  // Mark symbols that are exported
  for (const exp of exports) {
    if (exp.isDefault) continue;
    const symbol = symbols.find(s => s.name === exp.name);
    if (symbol) {
      // Symbol is already in the list with export info
    }
  }
}
