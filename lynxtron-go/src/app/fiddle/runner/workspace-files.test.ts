import { describe, expect, it } from 'vitest';
import {
  collectWorkspaceTextFiles,
  type WorkspaceDirectoryEntry,
  type WorkspaceFileSystem,
} from './workspace-files';

function createFixtureFs(files: Record<string, string>): WorkspaceFileSystem {
  const directories = new Set<string>(['/workspace']);
  for (const path of Object.keys(files)) {
    const parts = path.split('/').filter(Boolean);
    for (let i = 1; i < parts.length; i += 1) {
      directories.add('/' + parts.slice(0, i).join('/'));
    }
  }

  return {
    join: (left, right) => `${left}/${right}`.replace(/\/+/g, '/'),
    readFile: path => files[path] ?? null,
    readdirStat: dir => {
      const prefix = dir === '/' ? '/' : `${dir}/`;
      const children = new Map<string, WorkspaceDirectoryEntry>();
      for (const directory of directories) {
        if (!directory.startsWith(prefix) || directory === dir) continue;
        const rest = directory.slice(prefix.length);
        if (rest && !rest.includes('/')) {
          children.set(rest, { name: rest, isDirectory: true });
        }
      }
      for (const path of Object.keys(files)) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length);
        if (rest && !rest.includes('/')) {
          children.set(rest, { name: rest, isDirectory: false });
        }
      }
      return [...children.values()];
    },
  };
}

describe('collectWorkspaceTextFiles', () => {
  it('keeps nested renderer and main-process sources', () => {
    const fs = createFixtureFs({
      '/workspace/package.json': '{}',
      '/workspace/src/app/index.tsx': 'renderer',
      '/workspace/src/main/desktop/main.ts': 'main',
      '/workspace/src/main/desktop/preload.ts': 'preload',
    });

    expect(collectWorkspaceTextFiles(fs, '/workspace').map(file => file.rel)).toEqual([
      'package.json',
      'src/app/index.tsx',
      'src/main/desktop/main.ts',
      'src/main/desktop/preload.ts',
    ]);
  });

  it('skips generated directories, binaries, lockfiles, and oversized text', () => {
    const fs = createFixtureFs({
      '/workspace/node_modules/pkg/index.js': 'dependency',
      '/workspace/dist/main.js': 'generated',
      '/workspace/src/index.ts': 'source',
      '/workspace/thumbnail.png': 'binary',
      '/workspace/pnpm-lock.yaml': 'lock',
      '/workspace/src/huge.ts': 'x'.repeat(121 * 1024),
    });

    expect(collectWorkspaceTextFiles(fs, '/workspace')).toEqual([
      { rel: 'src/index.ts', content: 'source' },
    ]);
  });
});
