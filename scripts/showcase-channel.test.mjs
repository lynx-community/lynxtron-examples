import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identity, buildIndex, slugs, runtimeVersionFromWorkspace, releaseExists } from './showcase-channel.mjs';
import fs from 'node:fs';
const version = '0.1.13', sha = 'a'.repeat(40);
const pkg = { name: '@lynxtron-examples/browser', version: '0.1.1', showcase: { description: 'Browser' } };
const assets = slugs.map(slug => `lynxtron-examples-browser-${slug}.tgz`);
const repo = 'lynx-community/lynxtron-examples';
test('release lookup queries exactly one tag and projects before buffering', () => {
  for (const tag of [identity(version, sha).channel, identity(version, sha).tag, 'tag/with/slashes']) {
    let calls = 0;
    assert.equal(releaseExists(repo, tag, (command, args) => {
      calls++;
      assert.equal(command, 'gh');
      assert.deepEqual(args, ['api', `repos/${repo}/releases/tags/${encodeURIComponent(tag)}`, '--jq', '.tag_name']);
      return `${tag}\n`;
    }), true);
    assert.equal(calls, 1);
  }
});
const notFound = () => Object.assign(Error('Not Found'), { status: 1, stderr: Buffer.from('gh: Not Found (HTTP 404)\n') });
test('missing release requires confirmed 404 and accessible repository', () => {
  const calls = [];
  assert.equal(releaseExists(repo, 'missing', (command, args) => {
    calls.push(args);
    if (calls.length === 1) throw notFound();
    return '';
  }), false);
  assert.deepEqual(calls, [
    ['api', `repos/${repo}/releases/tags/missing`, '--jq', '.tag_name'],
    ['api', `repos/${repo}`, '--silent'],
  ]);
});
test('inaccessible repository is not treated as missing release', () => {
  const error = notFound();
  assert.throws(() => releaseExists(repo, 'missing', () => { throw error; }), e => e === error);
});
test('auth, rate limit, server, network and buffer failures abort lookup', () => {
  const errors = [401, 403, 429, 500, 502].map(status => Object.assign(Error('HTTP error'),
    { status: 1, stderr: `gh: Request failed (HTTP ${status})` }));
  errors.push(Object.assign(Error('spawnSync gh ENOBUFS'), { code: 'ENOBUFS', status: null }),
    Object.assign(Error('network failure'), { status: 1, stderr: 'dial tcp: no such host' }),
    Object.assign(Error('ambiguous 404'), { status: 1, stderr: '404' }));
  for (const error of errors) {
    let calls = 0;
    assert.throws(() => releaseExists(repo, 'tag', () => { calls++; throw error; }), e => e === error);
    assert.equal(calls, 1);
  }
});
test('unexpected successful response aborts lookup', () => {
  for (const response of ['', 'null', 'other-tag']) {
    assert.throws(() => releaseExists(repo, 'tag', () => response), /Unexpected release tag/);
  }
});
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
  assert.equal(runtimeVersionFromWorkspace(yaml), '0.0.28');
  assert.equal(runtimeVersionFromWorkspace(yaml.replace("'@lynx-js/lynxtron': 0.0.28", "'@lynx-js/lynxtron': 0.0.29")), '0.0.29');
  assert.throws(() => runtimeVersionFromWorkspace("allowBuilds:\n  '@lynx-js/lynxtron': true\n"));
  assert.throws(() => buildIndex({ version, sha, runtimeVersion: 'true', packages: [pkg], assets }), /runtime version/);
});
