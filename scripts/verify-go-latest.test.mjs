import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyLatest, installers } from './verify-go-latest.mjs';

const release = { tag_name: 'lynxtron-go-v0.1.13', draft: false, prerelease: false,
  assets: installers.map(name => ({ name, state: 'uploaded', size: 123 })) };
test('latest must retain the expected stable Go and every installer', () => {
  assert.equal(verifyLatest(release, release.tag_name), release.tag_name);
  for (const patch of [
    { tag_name: 'lynxtron-showcases-go-v0.1.13' },
    { tag_name: 'lynxtron-go-v0.1.13-dev.abc123' },
    { draft: true }, { prerelease: true },
  ]) assert.throws(() => verifyLatest({ ...release, ...patch }));
  assert.throws(() => verifyLatest(release, 'lynxtron-go-v0.1.14'), /changed/);
  for (const name of installers) {
    assert.throws(() => verifyLatest({ ...release, assets: release.assets.filter(a => a.name !== name) }), /missing/);
    assert.throws(() => verifyLatest({ ...release, assets: release.assets.map(a => a.name === name ? { ...a, size: 0 } : a) }), /missing/);
  }
});
