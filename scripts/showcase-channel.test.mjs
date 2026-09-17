import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identity, buildIndex, slugs, runtimeVersionFromWorkspace } from './showcase-channel.mjs';
import fs from 'node:fs';
const version = '0.1.13', sha = 'a'.repeat(40);
const pkg = { name: '@lynxtron-examples/browser', version: '0.1.1', showcase: { description: 'Browser' } };
const assets = slugs.map(slug => `lynxtron-examples-browser-${slug}.tgz`);
test('independent revisions share an explicit Go lane, not a date cutoff', () => {
  assert.equal(identity(version, sha).channel, 'lynxtron-showcases-go-v0.1.13');
  assert.notEqual(identity(version, sha).tag, identity(version, 'b'.repeat(40)).tag);
  assert.notEqual(identity(version, sha).channel, identity('0.1.14', sha).channel);
  assert.throws(() => identity('0.1.13-dev', sha));
  assert.throws(() => identity(version, 'main'));
});
test('publication requires every architecture and excludes builtin showcases', () => {
  const index = buildIndex({ version, sha, runtimeVersion: '0.0.23', packages: [pkg,
    { name: 'builtin', showcase: { distribution: 'builtin' } }], assets });
  assert.equal(index.showcases.length, 1);
  assert.equal(index.goVersion, version);
  assert.throws(() => buildIndex({ version, sha, runtimeVersion: '0.0.23', packages: [pkg], assets: assets.slice(1) }), /Missing/);
  assert.throws(() => buildIndex({ version, sha, runtimeVersion: '0.0.23', packages: [], assets }), /No release/);
});
test('reads actual workspace catalog, never allowBuilds boolean', () => {
  const yaml = fs.readFileSync(new URL('../pnpm-workspace.yaml', import.meta.url), 'utf8');
  assert.equal(runtimeVersionFromWorkspace(yaml), '0.0.23');
  assert.equal(runtimeVersionFromWorkspace(yaml.replace("'@lynx-js/lynxtron': 0.0.23", "'@lynx-js/lynxtron': 0.0.24")), '0.0.24');
  assert.throws(() => runtimeVersionFromWorkspace("allowBuilds:\n  '@lynx-js/lynxtron': true\n"));
  assert.throws(() => buildIndex({ version, sha, runtimeVersion: 'true', packages: [pkg], assets }), /runtime version/);
});
