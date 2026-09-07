import path from 'path';
import { pathToFileURL } from 'url';

export const APP_RESOURCE_ROOT_PROP = 'lynxtronGoResourceRoot';

export interface AppResourceLocation {
  isPackaged: boolean;
  resourcesPath?: string;
  moduleDir: string;
  platform?: NodeJS.Platform;
  execPath?: string;
}

/** Resolve the real directory used for files that native consumers must open. */
export function appResourceDir(location: AppResourceLocation): string {
  // Lynxtron's Windows packager places extraResources beside the executable.
  // macOS keeps them in Contents/Resources, outside app.asar.
  if (location.isPackaged && (location.platform ?? process.platform) === 'win32' && location.execPath) {
    return path.win32.dirname(location.execPath);
  }
  return location.isPackaged && location.resourcesPath
    ? path.resolve(location.resourcesPath)
    : path.resolve(location.moduleDir);
}

/**
 * File roots available to the app's Lynx resource loader. Keep moduleDir for
 * development/compiler output and add the external Resources directory for a
 * packaged app, where images live outside app.asar.
 */
export function appFileResourceRoots(
  location: AppResourceLocation,
  temporaryDir: string,
): string[] {
  return Array.from(new Set([
    appResourceDir(location),
    path.resolve(location.moduleDir),
    path.resolve(temporaryDir),
  ]));
}

export function appResourceRootUrl(resourceDir: string): string {
  return pathToFileURL(path.resolve(resourceDir) + path.sep).href;
}

export function appGlobalProps(resourceDir: string): Record<string, string> {
  return { [APP_RESOURCE_ROOT_PROP]: appResourceRootUrl(resourceDir) };
}
