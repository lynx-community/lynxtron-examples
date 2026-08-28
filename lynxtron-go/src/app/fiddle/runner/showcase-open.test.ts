// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadShowcaseFiddle, projectOverlayForFiles } from './showcase-open';

const temporaryRoots: string[] = [];

function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-showcase-open-'));
  temporaryRoots.push(root);
  fs.mkdirSync(path.join(root, 'src', 'app'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dist_precompiled', 'desktop'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: '@lynxtron-examples/hello-lynxtron',
    showcase: { distribution: 'builtin' },
  }));
  fs.writeFileSync(path.join(root, 'src', 'app', 'App.tsx'), 'export function App() { return <view />; }');
  fs.writeFileSync(path.join(root, 'dist_precompiled', 'desktop', 'main.js'), '// artifact host');
  fs.writeFileSync(path.join(root, 'dist_precompiled', 'desktop', 'main.lynx.bundle'), 'artifact');
  return root;
}

afterEach(() => {
  delete (globalThis as any).NativeModules;
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('projectOverlayForFiles', () => {
  it('leaves a complete project tree unchanged', () => {
    const files = { 'src/app/App.tsx': 'app', 'package.json': '{}' };
    expect(projectOverlayForFiles(files)).toBe(files);
  });

  it('migrates the legacy five-file shape into the standard source tree', () => {
    expect(projectOverlayForFiles({
      'main.js': 'main',
      'renderer.js': 'renderer',
      'preload.js': 'preload',
      'styles.css': 'css',
      'package.json': '{"name":"old"}',
    })).toEqual({
      'src/main/desktop/main.ts': 'main',
      'src/app/index.tsx': 'renderer',
      'src/main/desktop/preload.ts': 'preload',
      'src/app/App.css': 'css',
      'package.json': '{"name":"old"}',
    });
  });
});

describe('loadShowcaseFiddle', () => {
  it('surfaces editable source and never opens immutable precompiled files', () => {
    const root = makeWorkspace();
    (globalThis as any).NativeModules = {
      nodejs: {
        exposed: {
          fs: {
            readdir: (target: string) => fs.readdirSync(target),
            readFile: (target: string) => fs.readFileSync(target, 'utf8'),
            join: (...parts: string[]) => path.join(...parts),
          },
        },
      },
    };

    const snapshot = loadShowcaseFiddle({
      name: '@lynxtron-examples/hello-lynxtron',
      description: '',
      tags: [],
      url: 'builtin-showcase://hello-lynxtron',
      distribution: 'builtin',
    }, root);

    expect(snapshot).not.toBeNull();
    expect([...snapshot!.files.keys()]).toContain('src/app/App.tsx');
    expect([...snapshot!.files.keys()].some(file => file.startsWith('dist_precompiled/'))).toBe(false);
  });
});
