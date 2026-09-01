import { describe, expect, it } from 'vitest';
import { appResourcesPathForExecutable } from './preload-lynxtron-runtime';

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
