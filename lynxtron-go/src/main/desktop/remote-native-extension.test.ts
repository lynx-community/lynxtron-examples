import { describe, expect, it } from 'vitest';
import {
  extractNativeExtensionManifest,
  parseNativeExtensionManifest,
} from './remote-native-extension';

const manifest = {
  schemaVersion: 1,
  name: 'example-native-extension',
  platform: process.platform,
  arch: process.arch,
  entry: 'index.cjs',
  files: [{
    path: 'index.cjs',
    url: 'node_modules/example-native-extension/index.cjs',
    sha256: 'a'.repeat(64),
  }],
};

function bundleWith(value: unknown): Buffer {
  const encoded = Buffer.from(JSON.stringify(value)).toString('base64');
  return Buffer.from(`prefix LYNXTRON_NATIVE_EXTENSION_V1:${encoded}:END_LYNXTRON_NATIVE_EXTENSION suffix`);
}

describe('remote native extension declarations', () => {
  it('returns null when a bundle has no declaration', () => {
    expect(extractNativeExtensionManifest(Buffer.from('ordinary bundle'))).toBeNull();
  });

  it('extracts a valid declaration embedded in a bundle', () => {
    expect(extractNativeExtensionManifest(bundleWith(manifest))).toEqual(manifest);
  });

  it('rejects paths that escape the extension directory', () => {
    expect(() => parseNativeExtensionManifest({ ...manifest, entry: '../index.cjs' }))
      .toThrow('may not escape');
  });

  it('rejects an entry that is not part of the verified file list', () => {
    expect(() => parseNativeExtensionManifest({ ...manifest, entry: 'other.cjs' }))
      .toThrow('not listed');
  });
});
