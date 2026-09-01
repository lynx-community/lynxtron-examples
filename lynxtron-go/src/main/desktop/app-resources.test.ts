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
    // Golden URL is built from the same primitives so the assertion holds on
    // Windows too (where path.resolve prefixes a drive letter); the space must
    // stay percent-encoded, which is the whole point of the packaged path.
    expect(appResourceRootUrl(dir)).toBe(pathToFileURL(path.resolve(dir) + path.sep).href);
    expect(appResourceRootUrl(dir)).toContain('%20');
  });

  it('uses the stable global-props contract', () => {
    const dir = path.join(path.sep, 'tmp', 'lynxtron resources');
    expect(appGlobalProps(dir)).toEqual({
      [APP_RESOURCE_ROOT_PROP]: pathToFileURL(path.resolve(dir) + path.sep).href,
    });
    expect(appGlobalProps(dir)[APP_RESOURCE_ROOT_PROP]).toContain('%20');
  });

  it('uses the external Resources directory in packaged asar apps', () => {
    const resourcesPath = path.join(path.sep, 'Applications', 'Lynxtron Go.app', 'Contents', 'Resources');
    const location = {
      isPackaged: true,
      resourcesPath,
      moduleDir: path.join(resourcesPath, 'app.asar'),
    };
    const tmp = path.join(path.sep, 'tmp');
    expect(appResourceDir(location)).toBe(path.resolve(resourcesPath));
    expect(appFileResourceRoots(location, tmp)).toEqual(
      [resourcesPath, location.moduleDir, tmp].map(p => path.resolve(p)),
    );
  });

  it('uses the unpacked app directory in packaged non-asar apps (Windows)', () => {
    // Windows ships with `asar: false`, so the main process runs from
    // `…/resources/app`, which already holds the rspack-copied thumbnails and
    // brand marks. `resourcesPath` (`…/resources`) is one level too high and has
    // no thumbnails/ dir, which left every packaged thumbnail blank.
    const resourcesPath = path.join(path.sep, 'opt', 'Lynxtron Go', 'resources');
    const location = {
      isPackaged: true,
      resourcesPath,
      moduleDir: path.join(resourcesPath, 'app'),
    };
    const tmp = path.join(path.sep, 'tmp');
    expect(appResourceDir(location)).toBe(path.resolve(location.moduleDir));
    expect(appFileResourceRoots(location, tmp)).toEqual(
      [location.moduleDir, tmp].map(p => path.resolve(p)),
    );
  });

  it('keeps development resources beside the built main process', () => {
    const location = {
      isPackaged: false,
      resourcesPath: path.join(path.sep, 'unused', 'Resources'),
      moduleDir: path.join(path.sep, 'workspace', 'dist', 'desktop'),
    };
    const tmp = path.join(path.sep, 'tmp');
    expect(appResourceDir(location)).toBe(path.resolve(location.moduleDir));
    expect(appFileResourceRoots(location, tmp)).toEqual(
      [location.moduleDir, tmp].map(p => path.resolve(p)),
    );
  });
});
