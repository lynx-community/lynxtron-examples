import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { bundleLocalDependencies } from './showcase-bundle-dependencies.mjs';

const require = createRequire(new URL('../packages/cli/package.json', import.meta.url));
const tar = require('tar');
function json(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

test('packed local dependencies install without a workspace, overrides or source checkout', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-isolated-install-'));
  try {
    const source = path.join(root, 'source');
    json(path.join(source, 'package.json'), {
      name: 'showcase-bundle-fixture', version: '1.0.0',
      dependencies: { 'native-fixture': 'file:./extension' },
    });
    json(path.join(source, 'extension/package.json'), {
      name: 'native-fixture', version: '1.0.0', main: 'index.cjs',
      dependencies: { 'headers-fixture': '1.0.0' },
    });
    fs.writeFileSync(path.join(source, 'extension/index.cjs'), 'module.exports = require("headers-fixture");');
    fs.writeFileSync(path.join(source, 'extension/module.cc'), '// native source');
    json(path.join(source, 'extension/node_modules/headers-fixture/package.json'), {
      name: 'headers-fixture', version: '1.0.0', main: 'index.js',
    });
    fs.writeFileSync(path.join(source, 'extension/node_modules/headers-fixture/index.js'), 'module.exports = 42;');
    fs.mkdirSync(path.join(source, 'node_modules'), { recursive: true });
    fs.cpSync(path.join(source, 'extension'), path.join(source, 'node_modules/native-fixture'), { recursive: true });
    const packed = path.join(root, 'package');
    fs.cpSync(source, packed, { recursive: true, filter: entry => !entry.includes('node_modules') });
    await bundleLocalDependencies(packed, source);
    const artifact = path.join(root, 'showcase.tgz');
    await tar.c({ file: artifact, gzip: true, cwd: root }, ['package']);
    fs.rmSync(source, { recursive: true });
    for (const manager of ['npm', 'pnpm']) {
      const consumer = path.join(root, manager);
      json(path.join(consumer, 'package.json'), { name: 'consumer', private: true });
      const args = manager === 'npm'
        ? ['install', artifact, '--ignore-scripts', '--no-audit', '--no-fund']
        : ['add', artifact, '--ignore-scripts', '--ignore-workspace'];
      execFileSync(process.platform === 'win32' ? `${manager}.cmd` : manager, args,
        { cwd: consumer, stdio: 'pipe', shell: process.platform === 'win32' });
      const consumerRequire = createRequire(path.join(consumer, 'package.json'));
      const installed = path.dirname(consumerRequire.resolve('showcase-bundle-fixture/package.json'));
      const installedRequire = createRequire(path.join(installed, 'package.json'));
      assert.equal(installedRequire('native-fixture'), 42);
      assert.equal(fs.readFileSync(path.join(installed, 'extension/module.cc'), 'utf8'), '// native source');
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rejects local dependencies omitted from the archive', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-missing-local-'));
  try {
    json(path.join(root, 'package.json'), { dependencies: { missing: 'file:../outside' } });
    await assert.rejects(bundleLocalDependencies(root, root), /must be included inside/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
