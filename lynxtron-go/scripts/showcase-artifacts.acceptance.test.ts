import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const { verifyNativeArch } = require('../../scripts/verify-native-arch.cjs');
const assets = process.env.SHOWCASE_ACCEPTANCE_DIR;

it.skipIf(!assets)('downloads every real workflow tgz over HTTP, validates release contents and native architecture', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-products-'));
  const slug = process.platform === 'darwin' ? `mac-${process.arch}` : 'win-x64';
  const names = fs.readdirSync(assets!).filter(name => name.endsWith(`-${slug}.tgz`));
  expect(names.length).toBeGreaterThan(0);
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent((req.url || '').slice(1));
    if (!names.includes(name)) { res.writeHead(404).end(); return; }
    fs.createReadStream(path.join(assets!, name)).pipe(res);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = (server.address() as any).port;
    for (const name of names) {
      const url = `http://127.0.0.1:${port}/${name}`;
      const { stdout, stderr } = await run(process.execPath,
        [path.resolve('../packages/cli/dist/index.js'), 'fetch', url],
        { env: { ...process.env, LYNXTRON_WORKSPACE: root }, timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
      const events = stdout.trim().split('\n').map(line => JSON.parse(line));
      expect(events.some(event => event.type === 'install-start')).toBe(false);
      const success = events.find(event => event.type === 'fetch-success');
      expect(success, stderr).toBeTruthy();
      const pkg = JSON.parse(fs.readFileSync(path.join(success.path, 'package.json'), 'utf8'));
      expect(pkg.showcase).toBeTruthy();
      const count = verifyNativeArch(success.path);
      if (/browser|native-texture-canvas|sqlite/.test(name)) expect(count).toBeGreaterThan(0);
      const metadata = JSON.parse(fs.readFileSync(path.join(success.path, '.lynxtron-go-cache.json'), 'utf8'));
      expect(metadata.sourceUrl).toBe(url);
      console.log(`ACCEPTED ${name}: ${pkg.version}, ${count} native binaries, no install`);
    }
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 900_000);
