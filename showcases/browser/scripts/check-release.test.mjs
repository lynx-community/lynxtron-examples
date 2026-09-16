import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertReleaseVersions } from './check-release.mjs';

const versions = version => Object.fromEntries(['@lynx-js/lynxtron', '@lynx-js/cef-webview', '@lynx-js/lynxtron-dev-plugins'].map(name => [name, version]));
test('blocks old, missing and prerelease dependencies', () => {
  for (const version of ['0.0.22', '0.0.23-dev', undefined]) {
    assert.throws(() => assertReleaseVersions(versions(version)), /requires stable/);
  }
});
test('allows coordinated stable 0.0.23 and later versions', () => {
  for (const version of ['0.0.23', '0.0.24', '0.1.0', '1.0.0']) {
    assert.doesNotThrow(() => assertReleaseVersions(versions(version)));
  }
});
test('blocks a mismatched CEF version', () => {
  assert.throws(() => assertReleaseVersions({ ...versions('0.0.24'), '@lynx-js/cef-webview': '0.0.23' }), /matching/);
});
