import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { readLynxtronPackageVersion } from './preload-lynxtron-runtime';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture(name = '@lynx-js/lynxtron', version = '0.0.17-dev') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-runtime-version-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'dist'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name, version }));
  return { root, entry: path.join(root, 'lynxtron.js') };
}

describe('bundled runtime version metadata', () => {
  it('uses installed binary distribution metadata ahead of the manifest', () => {
    const { root, entry } = fixture();
    fs.writeFileSync(path.join(root, 'dist', 'version'), '0.0.18\r\n');
    expect(readLynxtronPackageVersion(entry)).toBe('0.0.18');
  });
  it('uses the runtime manifest when distribution metadata is unavailable', () => {
    expect(readLynxtronPackageVersion(fixture().entry)).toBe('0.0.17-dev');
  });
  it('does not label GO application metadata as a runtime version', () => {
    expect(readLynxtronPackageVersion(fixture('lynxtron-go', '0.1.8').entry)).toBeNull();
  });
  it('ignores malformed metadata instead of displaying it', () => {
    const { root, entry } = fixture('@lynx-js/lynxtron', 'invalid');
    fs.writeFileSync(path.join(root, 'dist', 'version'), '<html>unavailable</html>');
    expect(readLynxtronPackageVersion(entry)).toBeNull();
  });
});
