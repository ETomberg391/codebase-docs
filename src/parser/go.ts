import type { CodeFile, SymbolInfo, ImportInfo, ExportInfo, ModuleInfo } from '../types.js';

/**
 * Parser for Go files.
 * Extracts symbols, imports, and exported identifiers.
 * In Go, exported = capitalized first letter.
 */
export function parse(file: CodeFile): ModuleInfo {
  const lines = file.content.split('\n');
  const symbols: SymbolInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];

  const seenSymbols = new Set<string>();

  // First pass: find package name and collect all top-level declarations
  let packageName = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const pkgMatch = line.trim().match(/^package\s+(\w+)/);
    if (pkgMatch) {
      packageName = pkgMatch[1];
      break;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    parseImport(line, i, lines, imports);
    parseSymbol(line, i, lines, seenSymbols, symbols, exports);
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

function parseImport(line: string, lineIdx: number, lines: string[], imports: ImportInfo[]): void {
  const trimmed = line.trim();

  // Single import: import "path"
  const singleMatch = trimmed.match(/^import\s+["'](.+?)["']/);
  if (singleMatch) {
    const source = singleMatch[1];
    imports.push({
      source,
      importedNames: [],
      isDefault: false,
      isTypeOnly: false,
      line: lineIdx + 1,
    });
    return;
  }

  // Named import: import alias "path"
  const namedMatch = trimmed.match(/^import\s+(\w+)\s+["'](.+?)["']/);
  if (namedMatch) {
    const alias = namedMatch[1];
    const source = namedMatch[2];
    imports.push({
      source,
      importedNames: [alias],
      isDefault: false,
      isTypeOnly: false,
      line: lineIdx + 1,
    });
    return;
  }

  // Start of import block: import (
  if (trimmed === 'import (') {
    // Collect all imports in the block
    let bracketCount = 1;
    let blockStart = lineIdx;
    
    for (let i = lineIdx + 1; i < lines.length; i++) {
      const blockLine = lines[i];
      for (const ch of blockLine) {
        if (ch === '(') bracketCount++;
        if (ch === ')') bracketCount--;
      }
      
      if (bracketCount === 0) {
        // Parse each line in the block
        for (let j = blockStart + 1; j < i; j++) {
          const blockLine = lines[j].trim();
          if (!blockLine) continue;
          
          // Named import: alias "path"
          const namedMatch = blockLine.match(/^(\w+)\s+["'](.+?)["']/);
          if (namedMatch) {
            imports.push({
              source: namedMatch[2],
              importedNames: [namedMatch[1]],
              isDefault: false,
              isTypeOnly: false,
              line: j + 1,
            });
          } else {
            // Regular import: "path"
            const pathMatch = blockLine.match(/^["'](.+?)["']/);
            if (pathMatch) {
              imports.push({
                source: pathMatch[1],
                importedNames: [],
                isDefault: false,
                isTypeOnly: false,
                line: j + 1,
              });
            }
          }
        }
        break;
      }
    }
    return;
  }
}

function parseSymbol(
  line: string,
  lineIdx: number,
  lines: string[],
  seenSymbols: Set<string>,
  symbols: SymbolInfo[],
  exports: ExportInfo[],
): void {
  const trimmed = line.trim();
  const lineNum = lineIdx + 1;

  // Skip non-declaration lines
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

  // Check if this is a top-level declaration (no indentation or at package level)
  const indent = line.search(/\S/);
  if (indent > 0) return; // Not top-level

  // type Name struct { / interface { / Name Type
  const typeMatch = trimmed.match(/^type\s+(\w+)\s+(struct|interface|map|chan|func|\w+)/);
  if (typeMatch) {
    const name = typeMatch[1];
    if (!seenSymbols.has(`type:${name}`)) {
      seenSymbols.add(`type:${name}`);
      const endLine = findBlockEnd(lines, lineIdx);
            const isExportedFlag = isExported(name);
      symbols.push({
        name,
        kind: 'type',
        line: lineNum,
        endLine,
        snippet: getSnippet(lines, lineIdx, endLine),
        docComment: extractDocComment(lines, lineIdx),
      });
      if (isExportedFlag) {
        exports.push({ name, isDefault: false, isType: true, line: lineNum });
      }
    }
    return;
  }

  // func Name(...)
  const funcMatch = trimmed.match(/^func\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?(\w+)/);
  if (funcMatch) {
    const name = funcMatch[1];
    if (!seenSymbols.has(`function:${name}`)) {
      seenSymbols.add(`function:${name}`);
      const endLine = findBlockEnd(lines, lineIdx);
            const isExportedFlag = isExported(name);
      symbols.push({
        name,
        kind: 'function',
        line: lineNum,
        endLine,
        snippet: getSnippet(lines, lineIdx, endLine),
        docComment: extractDocComment(lines, lineIdx),
      });
      if (isExportedFlag) {
        exports.push({ name, isDefault: false, isType: false, line: lineNum });
      }
    }
    return;
  }

  // var Name / const Name
  const varMatch = trimmed.match(/^(var|const)\s+(\w+)/);
  if (varMatch) {
    const kind = varMatch[1];
    const name = varMatch[2];
    if (!seenSymbols.has(`${kind}:${name}`)) {
      seenSymbols.add(`${kind}:${name}`);
      const endLine = findVarEnd(lines, lineIdx);
            const isExportedFlag = isExported(name);
      symbols.push({
        name,
        kind: kind === 'const' ? 'constant' : 'variable',
        line: lineNum,
        endLine,
        snippet: getSnippet(lines, lineIdx, endLine),
        docComment: extractDocComment(lines, lineIdx),
      });
      if (isExportedFlag) {
        exports.push({ name, isDefault: false, isType: false, line: lineNum });
      }
    }
    return;
  }

  // var ( ... ) or const ( ... ) blocks
  const blockMatch = trimmed.match(/^(var|const)\s*\(/);
  if (blockMatch) {
    const kind = blockMatch[1];
    let parenCount = 1;
    
    for (let i = lineIdx + 1; i < lines.length; i++) {
      const blockLine = lines[i];
      for (const ch of blockLine) {
        if (ch === '(') parenCount++;
        if (ch === ')') parenCount--;
      }
      
      if (parenCount === 0) break;
      
      // Parse individual declarations in the block
      const declMatch = blockLine.trim().match(/^(\w+)\s+(?:\w+|interface|struct|map|chan|\[])/);
      if (declMatch) {
        const name = declMatch[1];
        if (!seenSymbols.has(`${kind}:${name}`)) {
          seenSymbols.add(`${kind}:${name}`);
                const isExportedFlag = isExported(name);
          symbols.push({
            name,
            kind: kind === 'const' ? 'constant' : 'variable',
            line: i + 1,
            endLine: i + 1,
            snippet: blockLine.trim(),
            docComment: extractDocComment(lines, i),
          });
          if (isExportedFlag) {
            exports.push({ name, isDefault: false, isType: false, line: i + 1 });
          }
        }
      }
    }
    return;
  }
}

function isExported(name: string): boolean {
  // In Go, a name is exported if its first letter is uppercase
  return name.length > 0 && name[0] >= 'A' && name[0] <= 'Z';
}

function findBlockEnd(lines: string[], startIdx: number): number {
  let braceCount = 0;
  let started = false;

  for (let i = startIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { braceCount++; started = true; }
      else if (ch === '}') { braceCount--; }
    }
    if (started && braceCount === 0) {
      return i + 1; // 1-indexed
    }
  }

  return startIdx + 1;
}

function findVarEnd(lines: string[], startIdx: number): number {
  const line = lines[startIdx];
  if (line.includes('{')) {
    return findBlockEnd(lines, startIdx);
  }
  return startIdx + 1; // 1-indexed
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

function extractDocComment(lines: string[], lineIdx: number): string | undefined {
  // Go doc comments are // comments on the line(s) immediately before the declaration
  // They should not have a blank line between the comment and the declaration
  if (lineIdx === 0) return undefined;

  const prevLine = lines[lineIdx - 1].trim();
  if (!prevLine.startsWith('//')) return undefined;

  // Collect consecutive comment lines
  const commentLines: string[] = [];
  let idx = lineIdx - 1;
  while (idx >= 0 && lines[idx].trim().startsWith('//')) {
    commentLines.unshift(lines[idx].trim().replace(/^\/\/\s?/, ''));
    idx--;
  }

  return commentLines.join('\n') || undefined;
}
