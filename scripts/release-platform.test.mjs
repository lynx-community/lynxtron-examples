import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releasePlatform } from './release-platform.cjs';
test('native release slugs are platform and architecture specific', () => {
  assert.equal(releasePlatform('darwin', 'arm64'), 'mac-arm64');
  assert.equal(releasePlatform('darwin', 'x64'), 'mac-x64');
  assert.equal(releasePlatform('win32', 'x64'), 'win-x64');
  assert.throws(() => releasePlatform('win32', 'arm64'), /Unsupported/);
  assert.throws(() => releasePlatform('linux', 'x64'), /Unsupported/);
});
