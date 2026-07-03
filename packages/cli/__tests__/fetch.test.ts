import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tar from 'tar';
import { pathToFileURL } from 'url';
import { clearFetchDestination, fetch } from '../src/commands/fetch';

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

  it('clears stale target contents before extracting a local tarball', async () => {
    const workspaceRoot = makeTempDir('lynxtron-fetch-ws-');
    const packageRoot = makeTempDir('lynxtron-fetch-pkg-');
    const packageDir = path.join(packageRoot, 'package');
    const tarPath = path.join(packageRoot, 'counter-0.0.1.tgz');
    const destDir = path.join(workspaceRoot, 'showcases', 'counter');

    fs.mkdirSync(path.join(packageDir, 'dist', 'desktop'), { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, 'package.json'),
      JSON.stringify({ name: 'counter', version: '0.0.1', private: true }, null, 2),
      'utf-8',
    );
    fs.writeFileSync(path.join(packageDir, 'dist', 'desktop', 'main.js'), '// built output\n', 'utf-8');
    await tar.c({ gzip: true, file: tarPath, cwd: packageRoot }, ['package']);

    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, 'stale.txt'), 'stale', 'utf-8');

    await fetch(pathToFileURL(tarPath).href, workspaceRoot);

    expect(fs.existsSync(path.join(destDir, 'stale.txt'))).toBe(false);
    expect(fs.existsSync(path.join(destDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(destDir, 'dist', 'desktop', 'main.js'))).toBe(true);
  });
});
