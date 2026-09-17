import { describe, expect, it } from 'vitest';
import { resolveShowcaseArtifactUrl } from './showcase-artifact';
const base = 'https://github.com/lynx-community/lynxtron-examples/releases/download/lynxtron-go-v0.1.13/';
describe('native showcase download selection', () => {
  for (const name of ['lynxtron-examples-browser', 'lynxtron-examples-native-texture-canvas', 'lynxtron-examples-todolist', 'lynxtron-go']) {
    it(`selects all architectures for ${name}`, () => {
      const url = `${base}${name}-mac-arm64.tgz`;
      expect(resolveShowcaseArtifactUrl(url, 'darwin', 'x64')).toBe(`${base}${name}-mac-x64.tgz`);
      expect(resolveShowcaseArtifactUrl(url, 'darwin', 'arm64')).toBe(url);
      expect(resolveShowcaseArtifactUrl(url, 'win32', 'x64')).toBe(`${base}${name}-win-x64.tgz`);
      expect(() => resolveShowcaseArtifactUrl(url, 'linux', 'x64')).toThrow(/Unsupported/);
    });
  }
  it('does not rewrite arbitrary sources', () => {
    for (const url of ['file:///tmp/example.tgz', 'https://example.com/browser-mac-arm64.tgz', 'https://github.com/other/repo/releases/download/v1/browser-mac-arm64.tgz']) {
      expect(resolveShowcaseArtifactUrl(url, 'darwin', 'x64')).toBe(url);
    }
  });
  it('preserves old arm64 URLs and rejects unsupported legacy x64', () => {
    const url = `${base}lynxtron-examples-browser-mac.tgz`;
    expect(resolveShowcaseArtifactUrl(url, 'darwin', 'arm64')).toBe(url);
    expect(() => resolveShowcaseArtifactUrl(url, 'darwin', 'x64')).toThrow(/legacy/);
  });
});
