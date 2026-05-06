import { describe, it, expect } from 'vitest';
import { parse as parseTS } from '../src/parser/typescript.js';
import { parse as parsePy } from '../src/parser/python.js';
import { parse as parseGo } from '../src/parser/go.js';
import type { CodeFile } from '../src/types.js';

describe('TypeScript parser', () => {
  function createFile(content: string): CodeFile {
    return { path: 'test.ts', language: 'typescript', content };
  }

  it('parses exported functions', () => {
    const file = createFile(`
export function hello() {
  return "world";
}
`);
    const result = parseTS(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].name).toBe('hello');
    expect(result.symbols[0].kind).toBe('function');
    expect(result.exports.length).toBe(1);
    expect(result.exports[0].name).toBe('hello');
  });

  it('parses exported classes', () => {
    const file = createFile(`
export class MyClass {
  constructor() {}
  method() {}
}
`);
    const result = parseTS(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].name).toBe('MyClass');
    expect(result.symbols[0].kind).toBe('class');
    expect(result.exports.length).toBe(1);
  });

  it('parses exported interfaces', () => {
    const file = createFile(`
export interface User {
  name: string;
  age: number;
}
`);
    const result = parseTS(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].name).toBe('User');
    expect(result.symbols[0].kind).toBe('interface');
    expect(result.exports.length).toBe(1);
  });

  it('parses exported types', () => {
    const file = createFile(`
export type UserId = string;
`);
    const result = parseTS(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].name).toBe('UserId');
    expect(result.symbols[0].kind).toBe('type');
    expect(result.exports.length).toBe(1);
  });

  it('parses exported constants', () => {
    const file = createFile(`
export const MAX_SIZE = 100;
`);
    const result = parseTS(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].name).toBe('MAX_SIZE');
    expect(result.symbols[0].kind).toBe('constant');
    expect(result.exports.length).toBe(1);
  });

  it('parses imports', () => {
    const file = createFile(`
import { foo, bar } from './other';
import baz from './another';
import * as utils from './utils';
`);
    const result = parseTS(file);
    
    expect(result.imports.length).toBe(3);
    expect(result.imports[0].source).toBe('./other');
    expect(result.imports[0].importedNames).toContain('foo');
    expect(result.imports[0].importedNames).toContain('bar');
    expect(result.imports[1].source).toBe('./another');
    expect(result.imports[1].isDefault).toBe(true);
  });

  it('parses named exports', () => {
    const file = createFile(`
export { foo, bar as renamed };
`);
    const result = parseTS(file);
    
    expect(result.exports.length).toBe(2);
    expect(result.exports[0].name).toBe('foo');
    expect(result.exports[1].name).toBe('renamed');
  });

  it('parses default export', () => {
    const file = createFile(`
export default function() {}
`);
    const result = parseTS(file);
    
    expect(result.exports.length).toBe(1);
    expect(result.exports[0].isDefault).toBe(true);
  });

  it('parses enums', () => {
    const file = createFile(`
export enum Color {
  Red,
  Green,
  Blue
}
`);
    const result = parseTS(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].name).toBe('Color');
    expect(result.symbols[0].kind).toBe('enum');
    expect(result.exports.length).toBe(1);
  });

  it('extracts JSDoc comments', () => {
    const file = createFile(`
/**
 * Returns the greeting message.
 * @param name - The name to greet
 */
export function greet(name: string): string {
  return \`Hello, \${name}\`;
}
`);
    const result = parseTS(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].docComment).toBeDefined();
    expect(result.symbols[0].docComment!).toContain('Returns the greeting');
  });

  it('handles async functions', () => {
    const file = createFile(`
export async function fetchData(): Promise<string> {
  return 'data';
}
`);
    const result = parseTS(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].name).toBe('fetchData');
    expect(result.symbols[0].kind).toBe('function');
  });

  it('handles arrow function exports', () => {
    const file = createFile(`
export const handler = (req: any) => {
  return 'ok';
};
`);
    const result = parseTS(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].name).toBe('handler');
  });

  it('handles namespace exports', () => {
    const file = createFile(`
export namespace Utils {
  export function helper() {}
}
`);
    const result = parseTS(file);
    
    expect(result.symbols.length).toBeGreaterThanOrEqual(1);
    expect(result.exports.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Python parser', () => {
  function createFile(content: string): CodeFile {
    return { path: 'test.py', language: 'python', content };
  }

  it('parses functions', () => {
    const file = createFile(`
def hello():
    return "world"
`);
    const result = parsePy(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].name).toBe('hello');
    expect(result.symbols[0].kind).toBe('function');
  });

  it('parses classes', () => {
    const file = createFile(`
class MyClass:
    def __init__(self):
        pass
`);
    const result = parsePy(file);
    
    expect(result.symbols.length).toBeGreaterThanOrEqual(1);
    const cls = result.symbols.find(s => s.name === 'MyClass');
    expect(cls).toBeDefined();
    expect(cls!.kind).toBe('class');
  });

  it('parses imports', () => {
    const file = createFile(`
from os import path
import sys
from collections import defaultdict as dd
`);
    const result = parsePy(file);
    
    expect(result.imports.length).toBe(3);
    expect(result.imports[0].source).toBe('os');
    expect(result.imports[0].importedNames).toContain('path');
    expect(result.imports[1].source).toBe('sys');
  });

  it('parses __all__ exports', () => {
    const file = createFile(`
__all__ = ['foo', 'bar', 'baz']
`);
    const result = parsePy(file);
    
    expect(result.exports.length).toBe(3);
    expect(result.exports[0].name).toBe('foo');
    expect(result.exports[1].name).toBe('bar');
  });

  it('extracts docstrings', () => {
    const file = createFile(`
def greet(name):
    """Returns a greeting."""
    return f"Hello, {name}"
`);
    const result = parsePy(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].docComment).toContain('Returns a greeting');
  });

  it('parses async functions', () => {
    const file = createFile(`
async def fetch():
    return "data"
`);
    const result = parsePy(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].name).toBe('fetch');
    expect(result.symbols[0].kind).toBe('function');
  });

  it('parses module-level variables', () => {
    const file = createFile(`
MAX_SIZE = 100
name = "test"
`);
    const result = parsePy(file);
    
    const vars = result.symbols.filter(s => s.kind === 'constant' || s.kind === 'variable');
    expect(vars.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Go parser', () => {
  function createFile(content: string): CodeFile {
    return { path: 'test.go', language: 'go', content };
  }

  it('parses exported functions', () => {
    const file = createFile(`
package main

func Hello() string {
    return "world"
}
`);
    const result = parseGo(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].name).toBe('Hello');
    expect(result.symbols[0].kind).toBe('function');
    expect(result.exports.length).toBe(1);
  });

  it('does not export lowercase functions', () => {
    const file = createFile(`
package main

func hello() string {
    return "world"
}
`);
    const result = parseGo(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].name).toBe('hello');
    expect(result.exports.length).toBe(0);
  });

  it('parses exported types', () => {
    const file = createFile(`
package main

type User struct {
    Name string
}
`);
    const result = parseGo(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].name).toBe('User');
    expect(result.symbols[0].kind).toBe('type');
    expect(result.exports.length).toBe(1);
  });

  it('parses imports', () => {
    const file = createFile(`
package main

import (
    "fmt"
    "os"
)
`);
    const result = parseGo(file);
    
    expect(result.imports.length).toBe(2);
    expect(result.imports[0].source).toBe('fmt');
    expect(result.imports[1].source).toBe('os');
  });

  it('parses named imports', () => {
    const file = createFile(`
package main

import alias "some/package"
`);
    const result = parseGo(file);
    
    expect(result.imports.length).toBe(1);
    expect(result.imports[0].source).toBe('some/package');
    expect(result.imports[0].importedNames).toContain('alias');
  });

  it('parses exported constants', () => {
    const file = createFile(`
package main

const MaxSize = 100
`);
    const result = parseGo(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].name).toBe('MaxSize');
    expect(result.symbols[0].kind).toBe('constant');
    expect(result.exports.length).toBe(1);
  });

  it('extracts doc comments', () => {
    const file = createFile(`
package main

// Hello returns a greeting
func Hello() string {
    return "world"
}
`);
    const result = parseGo(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].docComment).toContain('returns a greeting');
  });

  it('parses method functions', () => {
    const file = createFile(`
package main

func (u *User) GetName() string {
    return u.Name
}
`);
    const result = parseGo(file);
    
    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].name).toBe('GetName');
  });
});
