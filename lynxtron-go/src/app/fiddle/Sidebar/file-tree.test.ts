import { describe, expect, it } from 'vitest';
import { flattenFileTree } from './file-tree';

describe('flattenFileTree', () => {
  const files = [
    'package.json',
    'src/app/index.tsx',
    'src/main/desktop/main.ts',
    'src/main/desktop/preload.ts',
  ];

  it('builds directory-first rows with the file basename', () => {
    expect(flattenFileTree(files, new Set())).toEqual([
      { kind: 'directory', path: 'src', name: 'src', depth: 0, expanded: true },
      { kind: 'directory', path: 'src/app', name: 'app', depth: 1, expanded: true },
      { kind: 'file', path: 'src/app/index.tsx', name: 'index.tsx', depth: 2 },
      { kind: 'directory', path: 'src/main', name: 'main', depth: 1, expanded: true },
      { kind: 'directory', path: 'src/main/desktop', name: 'desktop', depth: 2, expanded: true },
      { kind: 'file', path: 'src/main/desktop/main.ts', name: 'main.ts', depth: 3 },
      { kind: 'file', path: 'src/main/desktop/preload.ts', name: 'preload.ts', depth: 3 },
      { kind: 'file', path: 'package.json', name: 'package.json', depth: 0 },
    ]);
  });

  it('hides descendants of collapsed directories', () => {
    expect(flattenFileTree(files, new Set(['src/main']))).toEqual([
      { kind: 'directory', path: 'src', name: 'src', depth: 0, expanded: true },
      { kind: 'directory', path: 'src/app', name: 'app', depth: 1, expanded: true },
      { kind: 'file', path: 'src/app/index.tsx', name: 'index.tsx', depth: 2 },
      { kind: 'directory', path: 'src/main', name: 'main', depth: 1, expanded: false },
      { kind: 'file', path: 'package.json', name: 'package.json', depth: 0 },
    ]);
  });
});
