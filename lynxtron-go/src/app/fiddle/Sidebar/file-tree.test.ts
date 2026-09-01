import { describe, expect, it } from 'vitest';
import { buildCompactFileTree } from './file-tree';

describe('buildCompactFileTree', () => {
  it('keeps root files and compacts a single-directory chain', () => {
    expect(buildCompactFileTree([
      'package.json',
      'src/app/index.tsx',
      'src/app/App.tsx',
    ])).toEqual([
      {
        kind: 'folder',
        path: 'src/app',
        name: 'src/app',
        children: [
          { kind: 'file', id: 'src/app/App.tsx', name: 'App.tsx' },
          { kind: 'file', id: 'src/app/index.tsx', name: 'index.tsx' },
        ],
      },
      { kind: 'file', id: 'package.json', name: 'package.json' },
    ]);
  });

  it('preserves a directory level when it branches', () => {
    expect(buildCompactFileTree([
      'src/app/index.tsx',
      'src/main/index.ts',
    ])).toEqual([
      {
        kind: 'folder',
        path: 'src',
        name: 'src',
        children: [
          {
            kind: 'folder',
            path: 'src/app',
            name: 'app',
            children: [{ kind: 'file', id: 'src/app/index.tsx', name: 'index.tsx' }],
          },
          {
            kind: 'folder',
            path: 'src/main',
            name: 'main',
            children: [{ kind: 'file', id: 'src/main/index.ts', name: 'index.ts' }],
          },
        ],
      },
    ]);
  });

  it('does not compact through a directory that owns a file', () => {
    expect(buildCompactFileTree([
      'src/index.ts',
      'src/app/App.tsx',
    ])[0]).toEqual({
      kind: 'folder',
      path: 'src',
      name: 'src',
      children: [
        {
          kind: 'folder',
          path: 'src/app',
          name: 'app',
          children: [{ kind: 'file', id: 'src/app/App.tsx', name: 'App.tsx' }],
        },
        { kind: 'file', id: 'src/index.ts', name: 'index.ts' },
      ],
    });
  });
});
