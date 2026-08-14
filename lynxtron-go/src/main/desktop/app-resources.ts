import path from 'path';
import { pathToFileURL } from 'url';

export const APP_RESOURCE_ROOT_PROP = 'lynxtronGoResourceRoot';

export interface AppResourceLocation {
  isPackaged: boolean;
  resourcesPath?: string;
  moduleDir: string;
}

/** Resolve the real directory used for files that native consumers must open. */
export function appResourceDir(location: AppResourceLocation): string {
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
