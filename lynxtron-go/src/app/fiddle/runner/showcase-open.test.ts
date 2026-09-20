// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadProjectFiddle, loadShowcaseFiddle, projectOverlayForFiles } from './showcase-open';

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
  (globalThis as any).NativeModules = {
    nodejs: { exposed: { fs: {
      readdirStat: (target: string) => fs.readdirSync(target, { withFileTypes: true }).map(entry => ({
        name: entry.name, isDirectory: entry.isDirectory(), isSymbolicLink: entry.isSymbolicLink(),
      })),
      readFile: (target: string) => fs.readFileSync(target, 'utf8'),
      join: (...parts: string[]) => path.join(...parts),
    } } },
  };
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

  it('includes deep host files, more than 14 files and large source files', () => {
    const root = makeWorkspace();
    const expected = new Map<string, string>();
    for (let i = 0; i < 20; i++) expected.set(`scripts/test-${i}.mjs`, `// script ${i}`);
    expected.set('src/main/desktop/main.ts', '// host');
    expected.set('src/main/desktop/preload.ts', '// preload');
    expected.set('src/app/components/deep/nested/view.tsx', '// nested');
    expected.set('src/app/large.ts', '// large\n'.repeat(20000));
    for (const [rel, content] of expected) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), content);
    }
    for (const dir of ['node_modules', 'dist', 'output', 'build', 'coverage', '.git']) {
      fs.mkdirSync(path.join(root, dir));
      fs.writeFileSync(path.join(root, dir, 'ignored.js'), '// excluded');
    }
    const snapshot = loadProjectFiddle('full project', root, { kind: 'showcase', ref: root })!;
    expect(snapshot.files.size).toBe(expected.size + 2);
    for (const [rel, content] of expected) expect(snapshot.files.get(rel)?.currentText).toBe(content);
    expect([...snapshot.files.values()].filter(file => file.visible)).toHaveLength(4);
  });

  it('includes native sources and build definitions, but not compiled binaries', () => {
    const root = makeWorkspace();
    const sources = ['module/canvas.cc', 'module/canvas.h', 'module/surface.mm',
      'bindings/bind_napi.cc', 'CMakeLists.txt', 'cmake/options.cmake'];
    for (const file of [...sources, 'canvas.node', 'thumbnail.png']) {
      const target = path.join(root, 'native-texture-extension', file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, `// ${file}`);
    }
    const snapshot = loadProjectFiddle('native project', root, { kind: 'showcase', ref: root })!;
    for (const file of sources) {
      expect(snapshot.files.get(`native-texture-extension/${file}`)?.currentText).toBe(`// ${file}`);
    }
    expect(snapshot.files.has('native-texture-extension/canvas.node')).toBe(false);
    expect(snapshot.files.has('native-texture-extension/thumbnail.png')).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('does not follow cyclic or external symlinks', () => {
    const root = makeWorkspace();
    fs.symlinkSync(root, path.join(root, 'src', 'loop'));
    fs.symlinkSync(path.join(root, 'package.json'), path.join(root, 'linked.json'));
    const snapshot = loadProjectFiddle('links', root, { kind: 'showcase', ref: root })!;
    expect([...snapshot.files.keys()]).toEqual(['package.json', 'src/app/App.tsx']);
  });
});
