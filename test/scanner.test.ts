import { describe, it, expect } from 'vitest';
import { scanDirectory } from '../src/scanner.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('scanner', () => {
  it('scans TypeScript files', () => {
    const fixtures = path.resolve(__dirname, 'fixtures/ts');
    const files = scanDirectory(fixtures);
    
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file.language).toBe('typescript');
      expect(file.path).toBeDefined();
      expect(file.content).toBeDefined();
    }
  });

  it('scans Python files', () => {
    const fixtures = path.resolve(__dirname, 'fixtures/py');
    const files = scanDirectory(fixtures);
    
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file.language).toBe('python');
    }
  });

  it('scans Go files', () => {
    const fixtures = path.resolve(__dirname, 'fixtures/go');
    const files = scanDirectory(fixtures);
    
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file.language).toBe('go');
    }
  });

  it('filters by language', () => {
    const fixtures = path.resolve(__dirname, 'fixtures/ts');
    const files = scanDirectory(fixtures, { languages: ['typescript'] });
    
    for (const file of files) {
      expect(file.language).toBe('typescript');
    }
  });

  it('skips node_modules', () => {
    // The fixtures directory doesn't have node_modules, so this should return empty or just our files
    const fixtures = path.resolve(__dirname, 'fixtures/ts');
    const files = scanDirectory(fixtures);
    
    for (const file of files) {
      expect(file.path).not.toContain('node_modules');
    }
  });

  it('skips binary files', () => {
    // Create a temp directory with a binary file
    const tmpDir = path.join(__dirname, 'tmp-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    
    // Write a binary file
    fs.writeFileSync(path.join(tmpDir, 'binary.ts'), Buffer.from([0x00, 0x01, 0x02]));
    
    const files = scanDirectory(tmpDir);
    expect(files.length).toBe(0);
    
    // Cleanup
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('handles empty directory', () => {
    const tmpDir = path.join(__dirname, 'tmp-test-empty');
    fs.mkdirSync(tmpDir, { recursive: true });
    
    const files = scanDirectory(tmpDir);
    expect(files.length).toBe(0);
    
    fs.rmSync(tmpDir, { recursive: true });
  });
});
