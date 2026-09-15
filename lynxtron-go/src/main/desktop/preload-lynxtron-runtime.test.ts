import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { appResourcesPathForExecutable, findLynxtronExecutable } from './preload-lynxtron-runtime';

describe('explicit showcase runtime', () => {
  it.each(['darwin', 'win32'] as const)('selects release without devtool fallback on %s', (platform) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-runtime-'));
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue(platform);
    const binary = platform === 'darwin' ? 'lynxtron.app/Contents/MacOS/lynxtron' : 'lynxtron.exe';
    const devtool = path.join(root, 'dist', 'devtool', binary);
    const release = path.join(root, 'dist', 'release', binary);
    try {
      fs.mkdirSync(path.dirname(devtool), { recursive: true });
      fs.writeFileSync(devtool, '');
      expect(findLynxtronExecutable(root)).toBe(devtool);
      expect(findLynxtronExecutable(root, undefined, 'release')).toBeNull();
      fs.mkdirSync(path.dirname(release), { recursive: true });
      fs.writeFileSync(release, '');
      expect(findLynxtronExecutable(root, undefined, 'release')).toBe(release);
      expect(findLynxtronExecutable(root)).toBe(devtool);
    } finally {
      platformSpy.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('packaged runtime resource path', () => {
  it('derives macOS Resources without process.resourcesPath', () => {
    expect(appResourcesPathForExecutable(
      '/Applications/Lynxtron Go.app/Contents/MacOS/Lynxtron Go',
      'darwin',
    )).toBe('/Applications/Lynxtron Go.app/Contents/Resources');
  });

  it('derives Windows resources beside the executable', () => {
    expect(appResourcesPathForExecutable('C:\\Apps\\Lynxtron Go.exe', 'win32'))
      .toBe('C:\\Apps\\resources');
  });
});
