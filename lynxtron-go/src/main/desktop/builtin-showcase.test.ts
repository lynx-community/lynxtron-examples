import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';
import { builtinShowcaseRoots, createCustomProjectFromArchive, resolveBuiltinShowcaseSourceUrl } from './preload-showcase-service';
import * as tar from 'tar';

const temporaryRoots: string[] = [];
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-builtin-showcase-'));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('resolveBuiltinShowcaseSourceUrl', () => {
  it.runIf(process.platform === 'win32')('opens and materializes a starter from the Windows installer layout', async () => {
    const root = path.join(makeRoot(), 'Lynxtron Go');
    const builtinDir = path.join(root, 'builtin-showcases');
    const sourceDir = path.join(root, 'fixture', 'package');
    fs.mkdirSync(builtinDir, { recursive: true });
    fs.mkdirSync(path.join(sourceDir, 'src', 'app'), { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'package.json'), JSON.stringify({ name: 'hello', version: '1.0.0' }));
    fs.writeFileSync(path.join(sourceDir, 'src', 'app', 'App.tsx'), 'export const App = () => <text>Hello</text>;');
    const archive = path.join(builtinDir, 'lynxtron-examples-hello-lynxtron-0.1.8.tgz');
    await tar.c({ file: archive, cwd: path.dirname(sourceDir), gzip: true }, ['package']);

    // Exercise native filesystem resolution on Windows, including spaces.
    const roots = builtinShowcaseRoots({
      platform: process.platform,
      executablePath: path.join(root, 'Lynxtron Go.exe'),
      resourcesPath: path.join(root, 'resources'),
      detectedResourcesPath: path.join(root, 'resources'),
      moduleDir: path.join(root, 'resources', 'app'),
    });
    const resolved = resolveBuiltinShowcaseSourceUrl('builtin-showcase://hello-lynxtron', roots);
    expect(fileURLToPath(resolved)).toBe(archive);
    const project = await createCustomProjectFromArchive(fileURLToPath(resolved), path.join(root, 'projects'));
    expect(fs.readFileSync(path.join(project, 'src', 'app', 'App.tsx'), 'utf8')).toContain('<text>Hello</text>');
  });

  it('includes the Windows executable resource root without duplicating resources/', () => {
    expect(builtinShowcaseRoots({
      platform: 'win32',
      executablePath: 'C:\\Program Files\\Lynxtron Go\\Lynxtron Go.exe',
      resourcesPath: 'C:\\Program Files\\Lynxtron Go\\resources',
      detectedResourcesPath: 'C:\\Program Files\\Lynxtron Go\\resources',
      moduleDir: 'C:\\Program Files\\Lynxtron Go\\resources\\app',
    })).toEqual([
      'C:\\Program Files\\Lynxtron Go\\resources\\builtin-showcases',
      'C:\\Program Files\\Lynxtron Go\\builtin-showcases',
      'C:\\Program Files\\Lynxtron Go\\resources\\app\\builtin-showcases',
    ]);
  });

  it('preserves macOS external resources and development module roots', () => {
    expect(builtinShowcaseRoots({
      platform: 'darwin',
      executablePath: '/Applications/Go.app/Contents/MacOS/Go',
      resourcesPath: '/Applications/Go.app/Contents/Resources',
      detectedResourcesPath: null,
      moduleDir: '/Applications/Go.app/Contents/Resources/app.asar',
    })).toEqual([
      '/Applications/Go.app/Contents/Resources/builtin-showcases',
      '/Applications/Go.app/Contents/Resources/app.asar/builtin-showcases',
    ]);
    expect(builtinShowcaseRoots({
      platform: 'darwin', executablePath: '/runtime/lynxtron',
      resourcesPath: '', detectedResourcesPath: null, moduleDir: '/project/dist/desktop',
    })).toContain('/project/dist/desktop/builtin-showcases');
  });

  it('registers Hello as an installer-bundled standard showcase', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'showcase-registry.json'), 'utf8'));
    const entry = registry.showcases.find((item: any) => item.name === '@lynxtron-examples/hello-lynxtron');
    expect(entry).toMatchObject({
      path: 'showcases/hello-lynxtron',
      distribution: 'builtin',
      targets: ['desktop'],
    });
  });

  it('maps a logical built-in URL to its versioned installer artifact', () => {
    const root = makeRoot();
    const artifact = path.join(root, 'lynxtron-examples-hello-lynxtron-0.1.6-64b8f7.tgz');
    fs.writeFileSync(artifact, 'fixture');

    const resolved = resolveBuiltinShowcaseSourceUrl(
      'builtin-showcase://hello-lynxtron',
      [root],
    );

    expect(fileURLToPath(resolved)).toBe(artifact);
  });

  it('fails loudly when the installer omitted the built-in artifact', () => {
    const root = makeRoot();
    expect(() => resolveBuiltinShowcaseSourceUrl(
      'builtin-showcase://hello-lynxtron',
      [root],
    )).toThrow('Built-in showcase artifact not found for hello-lynxtron');
  });

  it('rejects an ambiguous installer resource directory', () => {
    const root = makeRoot();
    fs.writeFileSync(path.join(root, 'lynxtron-examples-hello-lynxtron-0.1.5.tgz'), 'old');
    fs.writeFileSync(path.join(root, 'lynxtron-examples-hello-lynxtron-0.1.6.tgz'), 'new');

    expect(() => resolveBuiltinShowcaseSourceUrl(
      'builtin-showcase://hello-lynxtron',
      [root],
    )).toThrow('Multiple built-in artifacts found for hello-lynxtron');
  });
});
