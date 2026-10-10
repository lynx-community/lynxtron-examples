import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PUBLIC_SHOWCASES = ['browser', 'cross-platform-notes', 'native-texture-canvas'];

function readShowcasePackage(name) {
  return JSON.parse(fs.readFileSync(new URL(`../showcases/${name}/package.json`, import.meta.url)));
}

for (const name of PUBLIC_SHOWCASES) {
  test(`${name} participates in public npm publishing`, () => {
    const pkg = readShowcasePackage(name);
    assert.notEqual(pkg.private, true);
    assert.equal(pkg.publishConfig.access, 'public');
    assert.equal(pkg.name, `@lynxtron-examples/${name}`);
    assert.ok(pkg.showcase);
  });
}

test('public showcases define allowlists for their runnable distributions', () => {
  for (const name of PUBLIC_SHOWCASES) {
    const pkg = readShowcasePackage(name);
    assert.ok(Array.isArray(pkg.files), `${name} must define a files allowlist`);
    assert.ok(pkg.files.includes('dist/desktop') || pkg.files.some(file => file.startsWith('dist/desktop/')),
      `${name} must publish dist/desktop`);
    if (pkg.showcase.targets?.includes('web')) {
      assert.ok(pkg.files.includes('dist/web') || pkg.files.some(file => file.startsWith('dist/web/')),
        `${name} must publish dist/web`);
    }
    assert.ok(!pkg.files.some(file => /(^|\/)output(?:\/|$)/.test(file)),
      `${name} must not allowlist output`);
  }
});

test('npm packs retain release files and exclude intermediate output', () => {
  for (const name of PUBLIC_SHOWCASES) {
    const pkg = readShowcasePackage(name);
    const root = mkdtempSync(path.join(os.tmpdir(), `lynxtron-${name}-pack-`));
    try {
      writeFileSync(path.join(root, 'package.json'), JSON.stringify({
        name: pkg.name,
        version: '0.0.0',
        files: pkg.files,
      }));

      const fixtureFiles = [
        'src/app/App.tsx',
        'dist/desktop/main.lynx.bundle',
        'output/bundle/lynx/main.lynx.bundle',
        'README.md',
      ];
      if (pkg.showcase.targets?.includes('web')) {
        fixtureFiles.push('dist/web/index.html', 'src/main/web/web-host.ts');
      }
      if (name === 'native-texture-canvas') {
        fixtureFiles.push('native-texture-extension/CMakeLists.txt');
      }
      for (const file of fixtureFiles) {
        const filePath = path.join(root, file);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        writeFileSync(filePath, `${file}\n`);
      }

      const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
        cwd: root,
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, `${name}: ${result.stderr}`);
      const packedFiles = JSON.parse(result.stdout)[0].files.map(file => file.path);
      assert.ok(packedFiles.includes('dist/desktop/main.lynx.bundle'),
        `${name} must pack the desktop bundle`);
      assert.ok(packedFiles.includes('src/app/App.tsx'),
        `${name} must pack authored source`);
      assert.ok(!packedFiles.some(file => file.startsWith('output/')),
        `${name} must not pack intermediate output`);
      if (pkg.showcase.targets?.includes('web')) {
        assert.ok(packedFiles.includes('dist/web/index.html'),
          `${name} must pack the web host`);
      }
      if (name === 'native-texture-canvas') {
        assert.ok(packedFiles.includes('native-texture-extension/CMakeLists.txt'),
          `${name} must pack native extension sources`);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('npm publication builds the Notes web host used by the documentation site', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
  assert.match(pkg.scripts.release, /cross-platform-notes run build:web && changeset publish/);
});
