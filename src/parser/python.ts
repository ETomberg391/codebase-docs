import type { CodeFile, SymbolInfo, ImportInfo, ExportInfo, ModuleInfo } from '../types.js';

/**
 * Parser for Python files.
 * Extracts symbols, imports, and module-level exports (__all__).
 */
export function parse(file: CodeFile): ModuleInfo {
  const lines = file.content.split('\n');
  const symbols: SymbolInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];

  const seenSymbols = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    parseImport(line, lineNum, imports);
    parseExport(line, i, lines, exports);
    parseSymbol(line, i, lines, seenSymbols, symbols);
  }

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
  const trimmed = line.trim();

  // from module import a, b, c
  const fromMatch = trimmed.match(/^from\s+([\w.]+)\s+import\s+(.+)/);
  if (fromMatch) {
    const source = fromMatch[1];
    const importClause = fromMatch[2];
    
    const importedNames: string[] = [];
    if (importClause === '*') {
      importedNames.push('*');
    } else {
      // Handle aliased imports: a as b
      const names = importClause
        .replace(/[()]/g, '')
        .split(',')
        .map(n => n.trim().split(/\s+as\s+/).pop()?.trim() || n.trim().split(/\s+as\s+/)[0]?.trim() || '')
        .filter(n => n);
      importedNames.push(...names);
    }

    imports.push({
      source,
      importedNames,
      isDefault: false,
      isTypeOnly: false,
      line: lineNum,
    });
    return;
  }

  // import module, module2
  const importMatch = trimmed.match(/^import\s+(.+)/);
  if (importMatch) {
    const clause = importMatch[1];
    const names = clause
      .split(',')
      .map(n => n.trim().split(/\s+as\s+/)[0]?.trim() || '')
      .filter(n => n);
    
    for (const name of names) {
      imports.push({
        source: name,
        importedNames: [name],
        isDefault: false,
        isTypeOnly: false,
        line: lineNum,
      });
    }
  }
}

function parseExport(line: string, lineIdx: number, lines: string[], exports: ExportInfo[]): void {
  // __all__ = ['a', 'b', 'c']
  if (line.trim().startsWith('__all__')) {
    // Collect the full __all__ assignment (may span multiple lines)
    let fullExpr = '';
    let bracketCount = 0;
    let started = false;
    
    for (let i = lineIdx; i < lines.length; i++) {
      fullExpr += lines[i];
      for (const ch of lines[i]) {
        if (ch === '[' || ch === '(') { bracketCount++; started = true; }
        else if (ch === ']' || ch === ')') { bracketCount--; }
      }
      if (started && bracketCount === 0) break;
    }

    // Extract names from the list
    const names = fullExpr.match(/['"](\w+)['"]/g)?.map(n => n.slice(1, -1)) || [];
    for (const name of names) {
      exports.push({ name, isDefault: false, isType: false, line: lineIdx + 1 });
    }
  }
}

function parseSymbol(
  line: string,
  lineIdx: number,
  lines: string[],
  seenSymbols: Set<string>,
  symbols: SymbolInfo[],
): void {
  const trimmed = line.trim();
  const lineNum = lineIdx + 1;

  // Skip comments and empty lines
  if (!trimmed || trimmed.startsWith('#')) return;

  // class Name(...):
  const classMatch = trimmed.match(/^class\s+(\w+)/);
  if (classMatch) {
    const name = classMatch[1];
    if (!seenSymbols.has(`class:${name}`)) {
      seenSymbols.add(`class:${name}`);
      const endLine = findBlockEndByIndent(lines, lineIdx);
      symbols.push({
        name,
        kind: 'class',
        line: lineNum,
        endLine,
        snippet: getSnippet(lines, lineIdx, endLine),
        docComment: extractDocstring(lines, lineIdx),
      });
    }
    return;
  }

  // def name(...):
  const funcMatch = trimmed.match(/^(async\s+)?def\s+(\w+)/);
  if (funcMatch) {
    const name = funcMatch[2];
    if (!seenSymbols.has(`function:${name}`)) {
      seenSymbols.add(`function:${name}`);
      const endLine = findBlockEndByIndent(lines, lineIdx);
      symbols.push({
        name,
        kind: 'function',
        line: lineNum,
        endLine,
        snippet: getSnippet(lines, lineIdx, endLine),
        docComment: extractDocstring(lines, lineIdx),
      });
    }
    return;
  }

  // @decorator (skip decorator lines, they're part of the function/class)
  if (trimmed.startsWith('@')) return;

  // Variable assignments at module level (no indentation)
  if (lineIdx > 0 && lines[lineIdx - 1].trim() === '' || lineIdx === 0) {
    const varMatch = trimmed.match(/^(\w+)\s*=/);
    if (varMatch && !trimmed.startsWith('import ') && !trimmed.startsWith('from ')) {
      const name = varMatch[1];
      // Skip common non-symbol assignments
      if (!['if', 'for', 'while', 'with', 'try', 'except', 'else', 'elif', 'return', 'yield', 'raise', 'pass', 'break', 'continue'].includes(name)) {
        if (!seenSymbols.has(`variable:${name}`)) {
          seenSymbols.add(`variable:${name}`);
          const endLine = findAssignmentEnd(lines, lineIdx);
          const kind = name === name.toUpperCase() ? 'constant' : 'variable';
          symbols.push({
            name,
            kind,
            line: lineNum,
            endLine,
            snippet: getSnippet(lines, lineIdx, endLine),
            docComment: extractDocstring(lines, lineIdx),
          });
        }
      }
    }
  }
}

function findBlockEndByIndent(lines: string[], startIdx: number): number {
  // Get the indentation of the declaration line
  const declLine = lines[startIdx];
  const declIndent = declLine.search(/\S/);

  // The block starts at the next indented line
  let blockIndent = -1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue; // Skip empty lines
    const indent = line.search(/\S/);
    if (indent > declIndent) {
      blockIndent = indent;
      break;
    }
    // If we hit a line at the same or lesser indentation, the block is empty (single-line definition)
    return startIdx + 1;
  }

  if (blockIndent === -1) {
    return startIdx + 1;
  }

  // Find where the block ends (line at same or lesser indentation)
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    const indent = line.search(/\S/);
    if (indent <= declIndent) {
      return i; // 1-indexed
    }
  }

  return lines.length; // 1-indexed
}

function findAssignmentEnd(lines: string[], startIdx: number): number {
  const declIndent = lines[startIdx].search(/\S/);
  
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    const indent = line.search(/\S/);
    if (indent <= declIndent) {
      return i; // 1-indexed
    }
  }

  return lines.length; // 1-indexed
}

function getSnippet(lines: string[], startIdx: number, endLine: number): string {
  const endIdx = Math.min(endLine, lines.length);
  const maxLines = 20;
  const actualEnd = Math.min(endIdx, startIdx + maxLines);
  
  const snippetLines = lines.slice(startIdx, actualEnd);
  while (snippetLines.length > 1 && !snippetLines[snippetLines.length - 1].trim()) {
    snippetLines.pop();
  }

  return snippetLines.join('\n');
}

function extractDocstring(lines: string[], lineIdx: number): string | undefined {
  // Look for docstring after the declaration
  for (let i = lineIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Check for triple-quoted string
    if (line.startsWith('"""') || line.startsWith("'''")) {
      const quote = line.substring(0, 3);
      
      // Single-line docstring
      if (line.includes(quote, 3) && line.endsWith(quote)) {
        return line.slice(3, -3).trim();
      }
      
      // Multi-line docstring
      const docLines: string[] = [];
      const firstLine = line.slice(3).trim();
      if (firstLine) docLines.push(firstLine);
      
      for (let j = i + 1; j < lines.length; j++) {
        const docLine = lines[j];
        if (docLine.includes(quote)) {
          const beforeQuote = docLine.substring(0, docLine.indexOf(quote));
          if (beforeQuote.trim()) docLines.push(beforeQuote.trim());
          break;
        }
        if (docLine.trim()) docLines.push(docLine.trim());
      }
      
      return docLines.join('\n') || undefined;
    }
    
    break;
  }
  
  return undefined;
}
