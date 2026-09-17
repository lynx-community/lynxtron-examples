import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
test('real changeset version drives initial Go release and later independent showcase release', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'changeset-distribution-'));
  const write = (file, value) => { const p = path.join(root, file); fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof value === 'string' ? value : JSON.stringify(value)); };
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const commit = () => { git('add', '.'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD'); };
  const version = () => execFileSync(process.execPath, [path.join(repo, 'node_modules/@changesets/cli/bin.js'), 'version'], { cwd: root, stdio: 'pipe' });
  const detect = before => {
    write('outputs', '');
    execFileSync(process.execPath, [path.join(repo, 'scripts/go-release.mjs'), 'detect'], {
      cwd: root, env: { ...process.env, BEFORE_SHA: before, GITHUB_OUTPUT: path.join(root, 'outputs') }, stdio: 'pipe',
    });
    return fs.readFileSync(path.join(root, 'outputs'), 'utf8');
  };
  try {
    git('init', '-q', '-b', 'main');
    write('package.json', { name: 'fixture', private: true, workspaces: ['lynxtron-go', 'packages/*', 'showcases/*'] });
    write('pnpm-workspace.yaml', 'packages:\n  - lynxtron-go\n  - packages/*\n  - showcases/*\n');
    const config = JSON.parse(fs.readFileSync(path.join(repo, '.changeset/config.json'), 'utf8'));
    write('.changeset/config.json', { ...config, changelog: false });
    write('lynxtron-go/package.json', { name: 'lynxtron-go', version: '0.1.12', private: true });
    write('packages/cli/package.json', { name: '@lynxtron-examples/cli', version: '0.0.10', private: true });
    write('showcases/browser/package.json', { name: '@lynxtron-examples/browser', version: '0.1.0', showcase: {} });
    write('.changeset/first.md', '---\n"lynxtron-go": patch\n"@lynxtron-examples/cli": patch\n---\n\nEnable channels.\n');
    const initial = commit();
    version(); commit();
    assert.match(detect(initial), /version=0.1.13\nchanged=true\nshowcases-changed=false/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'showcases/browser/package.json'))).version, '0.1.0');
    write('.changeset/browser.md', '---\n"@lynxtron-examples/browser": patch\n---\n\nUpdate browser only.\n');
    const next = commit();
    version(); commit();
    assert.match(detect(next), /version=0.1.13\nchanged=false\nshowcases-changed=true/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
