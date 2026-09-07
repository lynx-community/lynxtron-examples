import path from 'path';
import { pathToFileURL } from 'url';
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
      .toBe(pathToFileURL(path.resolve(dir) + path.sep).href);
  });

  it('uses the stable global-props contract', () => {
    expect(appGlobalProps('/tmp/lynxtron resources')).toEqual({
      [APP_RESOURCE_ROOT_PROP]: pathToFileURL(path.resolve('/tmp/lynxtron resources') + path.sep).href,
    });
  });

  it('uses the external Resources directory in packaged apps', () => {
    const location = {
      isPackaged: true,
      platform: 'darwin' as const,
      execPath: '/Applications/Lynxtron Go.app/Contents/MacOS/Lynxtron Go',
      resourcesPath: '/Applications/Lynxtron Go.app/Contents/Resources',
      moduleDir: '/Applications/Lynxtron Go.app/Contents/Resources/app.asar',
    };
    expect(appResourceDir(location)).toBe(path.resolve(location.resourcesPath));
    expect(appFileResourceRoots(location, '/tmp')).toEqual([
      path.resolve(location.resourcesPath),
      path.resolve(location.moduleDir),
      path.resolve('/tmp'),
    ]);
  });

  it('keeps development resources beside the built main process', () => {
    const location = {
      isPackaged: false,
      resourcesPath: '/unused/Resources',
      moduleDir: '/workspace/dist/desktop',
    };
    expect(appResourceDir(location)).toBe(path.resolve(location.moduleDir));
    expect(appFileResourceRoots(location, '/tmp')).toEqual([
      path.resolve(location.moduleDir),
      path.resolve('/tmp'),
    ]);
  });

  it('uses Windows executable siblings for packaged display assets', () => {
    const location = {
      isPackaged: true,
      platform: 'win32' as const,
      execPath: 'C:\\Program Files\\Lynxtron Go\\Lynxtron Go.exe',
      resourcesPath: 'C:\\Program Files\\Lynxtron Go\\resources',
      moduleDir: 'C:\\Program Files\\Lynxtron Go\\resources\\app',
    };
    expect(appResourceDir(location)).toBe('C:\\Program Files\\Lynxtron Go');
    expect(appResourceDir({ ...location, resourcesPath: undefined })).toBe('C:\\Program Files\\Lynxtron Go');
    expect(appResourceDir({ ...location, isPackaged: false })).toBe(path.resolve(location.moduleDir));
    if (process.platform === 'win32') {
      expect(appGlobalProps(appResourceDir(location))[APP_RESOURCE_ROOT_PROP])
        .toBe('file:///C:/Program%20Files/Lynxtron%20Go/');
      expect(appFileResourceRoots(location, 'C:\\Temp'))
        .toContain('C:\\Program Files\\Lynxtron Go');
    }
  });
});
