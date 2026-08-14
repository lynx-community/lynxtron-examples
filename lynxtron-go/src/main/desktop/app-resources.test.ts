import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  APP_RESOURCE_ROOT_PROP,
  appFileResourceRoots,
  appGlobalProps,
  appResourceDir,
  appResourceRootUrl,
} from './app-resources';

describe('packaged app resource globals', () => {
  it('creates an encoded file URL ending at the runtime resource directory', () => {
    const dir = path.join(path.sep, 'Applications', 'Lynxtron Go.app', 'Contents', 'Resources');
    expect(appResourceRootUrl(dir))
      .toBe('file:///Applications/Lynxtron%20Go.app/Contents/Resources/');
  });

  it('uses the stable global-props contract', () => {
    expect(appGlobalProps('/tmp/lynxtron resources')).toEqual({
      [APP_RESOURCE_ROOT_PROP]: 'file:///tmp/lynxtron%20resources/',
    });
  });

  it('uses the external Resources directory in packaged apps', () => {
    const location = {
      isPackaged: true,
      resourcesPath: '/Applications/Lynxtron Go.app/Contents/Resources',
      moduleDir: '/Applications/Lynxtron Go.app/Contents/Resources/app.asar',
    };
    expect(appResourceDir(location)).toBe(location.resourcesPath);
    expect(appFileResourceRoots(location, '/tmp')).toEqual([
      location.resourcesPath,
      location.moduleDir,
      '/tmp',
    ]);
  });

  it('keeps development resources beside the built main process', () => {
    const location = {
      isPackaged: false,
      resourcesPath: '/unused/Resources',
      moduleDir: '/workspace/dist/desktop',
    };
    expect(appResourceDir(location)).toBe(location.moduleDir);
    expect(appFileResourceRoots(location, '/tmp')).toEqual([
      location.moduleDir,
      '/tmp',
    ]);
  });
});
