import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectReleaseSize, fetchReleaseSize } from './src/main/desktop/release-size.ts';
const release = { tag_name: 'v0.0.22', assets: [
  { name: 'lynxtron-v0.0.22-darwin-arm64-devtool.zip', size: 99 },
  { name: 'lynxtron-v0.0.22-darwin-arm64-symbols.zip', size: 999 },
  { name: 'cef_webview-v0.0.22-darwin-arm64.zip', size: 9999 },
  { name: 'lynxtron-v0.0.22-darwin-arm64.zip', size: 23730728 },
  { name: 'lynxtron-v0.0.22-win32-x64.zip', size: 35125038 },
] };
test('select exact release platform ZIP, excluding other variants', () => {
  assert.equal(selectReleaseSize(release, 'darwin', 'arm64').bytes, 23730728);
  assert.equal(selectReleaseSize(release, 'win32', 'x64').bytes, 35125038);
  assert.throws(() => selectReleaseSize(release, 'win32', 'arm64'), /unavailable/);
});
test('reject prerelease and invalid size', () => {
  assert.throws(() => selectReleaseSize({ ...release, prerelease: true }, 'darwin', 'arm64'));
  assert.throws(() => selectReleaseSize({ ...release, assets: [{ name: release.assets[3].name, size: 0 }] }, 'darwin', 'arm64'));
});
test('fetch metadata only and propagate errors', async () => {
  let count = 0;
  const result = await fetchReleaseSize('darwin', 'arm64', async (url, options) => {
    count++;
    assert.equal(url, 'https://api.github.com/repos/lynx-family/lynxtron/releases/latest');
    assert.ok(options.signal);
    return { ok: true, json: async () => release };
  });
  assert.equal(result.bytes, 23730728);
  assert.equal(count, 1);
  await assert.rejects(fetchReleaseSize('darwin', 'arm64', async () => ({ ok: false, status: 403 })), /403/);
  await assert.rejects(fetchReleaseSize('darwin', 'arm64', async () => { throw new Error('offline'); }), /offline/);
});
