import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { releaseMetadata, versionBumped } from './go-release.mjs';

const base = { version: '0.1.10', ref: 'refs/heads/main', sha: 'a'.repeat(40) };
test('private Go bump triggers independently of npm publishedPackages', () => {
  assert.equal(versionBumped('0.1.9', '0.1.10'), true);
  assert.equal(versionBumped('0.1.10', '0.1.10'), false);
  assert.equal(versionBumped('0.1.10', '0.2.0'), true);
  assert.throws(() => versionBumped('0.1.10', '0.1.9'), /increase/);
  assert.throws(() => versionBumped('0.1.9', '0.1.10-dev'), /stable/);
});
test('stable tag is derived from the app version', () => {
  assert.deepEqual(releaseMetadata(base), { version: base.version, sha: base.sha, tag: 'lynxtron-go-v0.1.10', prerelease: false });
});
test('caller version and explicit tag cannot disagree with package version', () => {
  assert.throws(() => releaseMetadata({ ...base, expectedVersion: '0.1.9' }), /mismatch/);
  assert.throws(() => releaseMetadata({ ...base, tag: 'lynxtron-go-v0.1.9' }), /Tag must match/);
  assert.throws(() => releaseMetadata({ ...base, tag: 'x\nprerelease=false' }), /Tag must match/);
});
test('branch builds are prereleases; exact stable tag supports retries', () => {
  const preview = releaseMetadata({ ...base, ref: 'refs/heads/test' });
  assert.equal(preview.tag, 'lynxtron-go-v0.1.10-dev.aaaaaa');
  assert.equal(preview.prerelease, true);
  assert.equal(releaseMetadata({ ...base, ref: 'refs/tags/lynxtron-go-v0.1.10' }).prerelease, false);
  assert.throws(() => releaseMetadata({ ...base, ref: 'refs/heads/test', expectedVersion: base.version }), /main/);
});

test('reject invalid versions and unpinned source revisions', () => {
  for (const version of ['0.1.10-dev', '01.1.0', '', '0.1.10\ntag=wrong']) {
    assert.throws(() => releaseMetadata({ ...base, version }), /version/);
  }
  assert.throws(() => releaseMetadata({ ...base, sha: 'main' }), /full commit SHA/);
});

test('CLI detects the push version delta and resolves the actual checkout', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'go-release-test-'));
  const script = fileURLToPath(new URL('./go-release.mjs', import.meta.url));
  const outputFile = join(cwd, 'outputs');
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const writeVersion = (version) => writeFileSync(join(cwd, 'lynxtron-go/package.json'), JSON.stringify({ version, private: true }));
  try {
    mkdirSync(join(cwd, 'lynxtron-go'));
    git('init', '-q');
    writeVersion('0.1.9');
    git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'base');
    const before = git('rev-parse', 'HEAD');
    const run = (command, extra = {}) => {
      writeFileSync(outputFile, '');
      execFileSync(process.execPath, [script, command], {
        cwd, stdio: 'pipe', env: { ...process.env, GITHUB_OUTPUT: outputFile, BEFORE_SHA: before,
          GITHUB_REF: 'refs/heads/main', REQUESTED_TAG: '', EXPECTED_VERSION: '', ...extra },
      });
      return readFileSync(outputFile, 'utf8');
    };
    assert.match(run('detect'), /changed=false/);
    writeVersion('0.1.10');
    assert.match(run('detect'), /version=0.1.10\nchanged=true/);
    assert.match(run('resolve', { EXPECTED_VERSION: '0.1.10' }), new RegExp(`tag=lynxtron-go-v0.1.10\\nprerelease=false\\nsha=${before}`));
    assert.throws(() => run('resolve', { EXPECTED_VERSION: '0.1.9' }));
    assert.throws(() => run('detect', { BEFORE_SHA: '0'.repeat(40) }));
    writeVersion('0.1.9');
    mkdirSync(join(cwd, 'showcases/demo'), { recursive: true });
    const showcase = join(cwd, 'showcases/demo/package.json');
    writeFileSync(showcase, JSON.stringify({ version: '0.1.0', showcase: { distribution: 'builtin' } }));
    git('add', 'showcases');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'builtin');
    assert.match(run('detect'), /showcases-changed=false/);
    const builtin = git('rev-parse', 'HEAD');
    writeFileSync(showcase, JSON.stringify({ version: '0.1.1', showcase: { description: 'public' } }));
    git('add', 'showcases');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'showcase bump');
    assert.match(run('detect', { BEFORE_SHA: builtin }), /changed=false\nshowcases-changed=true/);
    const bumped = git('rev-parse', 'HEAD');
    writeFileSync(showcase, JSON.stringify({ version: '0.1.1', showcase: { description: 'metadata only' } }));
    git('add', 'showcases');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'metadata');
    assert.match(run('detect', { BEFORE_SHA: bumped }), /showcases-changed=false/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
