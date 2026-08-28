import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as http from 'http';
import * as tar from 'tar';
import { execFileSync } from 'child_process';
import { pathToFileURL } from 'url';
import { clearFetchDestination, fetch } from '../src/commands/fetch';
import {
  createShowcaseCacheKey,
  readShowcaseCacheMetadata,
  restorePreservedShowcaseCache,
  writeShowcaseCacheMetadata,
} from '../src/showcase-cache';
import { writeShowcaseReleaseManifest } from '../src/showcase-release';

function writePrecompiledDesktop(packageDir: string, marker: string): void {
  const desktop = path.join(packageDir, 'dist_precompiled', 'desktop');
  fs.mkdirSync(desktop, { recursive: true });
  fs.writeFileSync(path.join(desktop, 'main.js'), `// ${marker}\n`, 'utf-8');
  fs.writeFileSync(path.join(desktop, 'main.lynx.bundle'), `${marker} bundle\n`, 'utf-8');
  fs.writeFileSync(path.join(desktop, 'package.json'), JSON.stringify({ main: 'main.js' }), 'utf-8');
}

describe('fetch command', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    while (tmpDirs.length) {
      fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
    }
  });

  function makeTempDir(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
  }

  it('clears an existing fetch destination before reuse', () => {
    const root = makeTempDir('lynxtron-fetch-clear-');
    const destDir = path.join(root, 'showcases', 'counter');
    fs.mkdirSync(path.join(destDir, 'stale-dir'), { recursive: true });
    fs.writeFileSync(path.join(destDir, 'stale-dir', 'stale.txt'), 'stale', 'utf-8');

    clearFetchDestination(destDir);

    expect(fs.existsSync(destDir)).toBe(false);
    expect(fs.existsSync(path.join(root, 'showcases'))).toBe(true);
  });

  it('preserves a legacy workspace when a versioned cache replaces it', () => {
    const root = makeTempDir('lynxtron-fetch-preserve-');
    const destDir = path.join(root, 'showcases', 'floating-clock');
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, 'user-edit.ts'), '// keep me\n', 'utf-8');

    const backupPath = clearFetchDestination(
      destDir,
      'https://example.com/releases/v2/floating-clock.tgz',
    );

    expect(fs.existsSync(destDir)).toBe(false);
    expect(backupPath).not.toBeNull();
    const backups = fs.readdirSync(path.join(root, 'showcase-backups'));
    expect(backups).toHaveLength(1);
    expect(fs.readFileSync(
      path.join(root, 'showcase-backups', backups[0], 'user-edit.ts'),
      'utf-8',
    )).toBe('// keep me\n');

    restorePreservedShowcaseCache(destDir, backupPath!);
    expect(fs.readFileSync(path.join(destDir, 'user-edit.ts'), 'utf-8')).toBe('// keep me\n');
    expect(fs.existsSync(backupPath!)).toBe(false);
  });

  it('replaces a cache in place when its source URL still matches', () => {
    const root = makeTempDir('lynxtron-fetch-reuse-');
    const destDir = path.join(root, 'showcases', 'floating-clock');
    const sourceUrl = 'https://example.com/releases/v2/floating-clock.tgz';
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, 'stale.txt'), 'stale', 'utf-8');
    writeShowcaseCacheMetadata(destDir, sourceUrl);

    clearFetchDestination(destDir, sourceUrl);

    expect(fs.existsSync(destDir)).toBe(false);
    expect(fs.existsSync(path.join(root, 'showcase-backups'))).toBe(false);
  });

  it('clears stale target contents before extracting a local tarball', async () => {
    const workspaceRoot = makeTempDir('lynxtron-fetch-ws-');
    const packageRoot = makeTempDir('lynxtron-fetch-pkg-');
    const packageDir = path.join(packageRoot, 'package');
    const tarPath = path.join(packageRoot, 'counter-0.0.1.tgz');
    const destDir = path.join(workspaceRoot, 'showcases', 'counter');

    fs.mkdirSync(path.join(packageDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, 'package.json'),
      JSON.stringify({ name: 'counter', version: '0.0.1', private: true }, null, 2),
      'utf-8',
    );
    fs.writeFileSync(path.join(packageDir, 'src', 'index.tsx'), '// source\n', 'utf-8');
    writePrecompiledDesktop(packageDir, 'built output');
    writeShowcaseReleaseManifest(packageDir);
    await tar.c({ gzip: true, file: tarPath, cwd: packageRoot }, ['package']);

    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, 'stale.txt'), 'stale', 'utf-8');

    await fetch(pathToFileURL(tarPath).href, workspaceRoot);

    expect(fs.existsSync(path.join(destDir, 'stale.txt'))).toBe(false);
    expect(fs.existsSync(path.join(destDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(destDir, 'dist'))).toBe(false);
    expect(fs.existsSync(path.join(destDir, 'dist_precompiled', 'desktop', 'main.js'))).toBe(true);
  });

  it('downloads a packed release artifact and runs it without installing', async () => {
    const workspaceRoot = makeTempDir('lynxtron-fetch-remote-ws-');
    const packageRoot = makeTempDir('lynxtron-fetch-remote-pkg-');
    const packageDir = path.join(packageRoot, 'package');
    const tarPath = path.join(packageRoot, 'floating-clock.tgz');

    fs.mkdirSync(path.join(packageDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, 'package.json'),
      JSON.stringify({
        name: '@lynxtron-examples/floating-clock',
        version: '0.0.4',
        showcase: { description: 'clock' },
      }),
      'utf-8',
    );
    fs.writeFileSync(path.join(packageDir, 'src', 'index.tsx'), '// source\n', 'utf-8');
    writePrecompiledDesktop(packageDir, 'packed build');
    writeShowcaseReleaseManifest(packageDir);
    await tar.c({ gzip: true, file: tarPath, cwd: packageRoot }, ['package']);

    const server = http.createServer((request, response) => {
      if (request.url === '/lynxtron-examples-floating-clock.tgz') {
        response.writeHead(302, { location: '/download/floating-clock.tgz' });
        response.end();
        return;
      }
      response.writeHead(200, { 'content-type': 'application/octet-stream' });
      fs.createReadStream(tarPath).pipe(response);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('test server address unavailable');
      // Keep the public URL shaped like a Release asset while exercising the
      // redirect that GitHub uses for the actual object download.
      const url = `http://127.0.0.1:${address.port}/lynxtron-examples-floating-clock.tgz`;
      await fetch(url, workspaceRoot);
      const destDir = path.join(workspaceRoot, 'showcases', 'floating-clock');
      expect(fs.readFileSync(path.join(destDir, 'dist_precompiled', 'desktop', 'main.js'), 'utf-8'))
        .toBe('// packed build\n');
      expect(fs.existsSync(path.join(destDir, 'node_modules'))).toBe(false);
      expect(readShowcaseCacheMetadata(destDir)).toEqual({
        schemaVersion: 1,
        cacheKey: createShowcaseCacheKey(url),
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it('installs source-only showcase devDependencies with npm', async () => {
    const workspaceRoot = makeTempDir('lynxtron-fetch-source-ws-');
    const packageRoot = makeTempDir('lynxtron-fetch-source-pkg-');
    const packageDir = path.join(packageRoot, 'package');
    const tarPath = path.join(packageRoot, 'source-only.tgz');

    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, 'package.json'),
      JSON.stringify({
        name: '@lynxtron-examples/source-only',
        version: '0.0.1',
        scripts: { verify: 'cross-env FIXTURE_VALUE=ready node -e "process.exit(process.env.FIXTURE_VALUE === String.fromCharCode(114,101,97,100,121) ? 0 : 1)"' },
        devDependencies: { 'cross-env': '10.1.0' },
      }, null, 2),
      'utf-8',
    );
    await tar.c({ gzip: true, file: tarPath, cwd: packageRoot }, ['package']);

    await fetch(pathToFileURL(tarPath).href, workspaceRoot);

    const destDir = path.join(workspaceRoot, 'showcases', 'source-only');
    expect(fs.existsSync(path.join(destDir, 'node_modules', '.bin', 'cross-env'))).toBe(true);
    expect(() => execFileSync('npm', ['run', 'verify'], { cwd: destDir, stdio: 'pipe' })).not.toThrow();
  }, 120_000);
});
