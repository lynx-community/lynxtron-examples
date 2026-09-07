import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { afterEach, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { synchronizeRuntimeManifest } = require('./runtime-manifest.js');
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

it('pins the actual staged versions including npm aliases and fails on omitted packages', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-runtime-manifest-'));
  roots.push(root);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: {
    '@lynx-js/lynxtron': '0.0.10', preact: 'npm:@lynx-js/internal-preact@1.0.0',
  } }));
  for (const [name, manifest] of Object.entries({
    '@lynx-js/lynxtron': { name: '@lynx-js/lynxtron', version: '0.0.17-dev' },
    preact: { name: '@lynx-js/internal-preact', version: '10.29.1' },
  })) {
    const dir = path.join(root, 'node_modules', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest));
  }
  synchronizeRuntimeManifest(root);
  expect(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies).toEqual({
    '@lynx-js/lynxtron': '0.0.17-dev', preact: 'npm:@lynx-js/internal-preact@10.29.1',
  });
  fs.unlinkSync(path.join(root, 'node_modules/preact/package.json'));
  expect(() => synchronizeRuntimeManifest(root)).toThrow();
});
