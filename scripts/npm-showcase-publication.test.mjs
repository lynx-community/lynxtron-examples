import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const name of ['browser', 'cross-platform-notes', 'native-texture-canvas']) {
  test(`${name} participates in public npm publishing`, () => {
    const pkg = JSON.parse(fs.readFileSync(new URL(`../showcases/${name}/package.json`, import.meta.url)));
    assert.notEqual(pkg.private, true);
    assert.equal(pkg.publishConfig.access, 'public');
    assert.equal(pkg.name, `@lynxtron-examples/${name}`);
    assert.ok(pkg.showcase);
  });
}

test('npm publication builds the Notes web host used by the documentation site', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
  assert.match(pkg.scripts.release, /cross-platform-notes run build:web && changeset publish/);
});
