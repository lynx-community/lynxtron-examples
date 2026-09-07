import path from 'path';
import { pathToFileURL } from 'url';

export const APP_RESOURCE_ROOT_PROP = 'lynxtronGoResourceRoot';

export interface AppResourceLocation {
  isPackaged: boolean;
  resourcesPath?: string;
  moduleDir: string;
}

/** True when the app's main process is running from inside an `app.asar` archive. */
function isAsarModuleDir(moduleDir: string): boolean {
  return /(^|[\\/])[^\\/]+\.asar([\\/]|$)/.test(moduleDir);
}

/**
 * Resolve the real directory used for files that native consumers must open —
 * gallery thumbnails and brand marks loaded by Lynx `<image>`, and `help.html`.
 *
 * `<image>` reads the file:// URL itself and cannot look inside an `app.asar`,
 * so the directory must be one those files physically exist in AND is readable.
 *
 * - Packed in an asar (macOS default): the app dir is `…/Resources/app.asar`,
 *   unreadable by `<image>`. electron-builder `extraResources` copies the assets
 *   to the external resources root, so resolve to `resourcesPath`.
 * - Shipped unpacked (Windows `asar: false`): the app dir (`…/resources/app`) is
 *   plain and already holds the rspack-copied assets, so resolve there.
 *   `resourcesPath` points one level too high (`…/resources`, not
 *   `…/resources/app`), which left every packaged thumbnail blank.
 */
export function appResourceDir(location: AppResourceLocation): string {
  if (location.isPackaged && location.resourcesPath && isAsarModuleDir(location.moduleDir)) {
    return path.resolve(location.resourcesPath);
  }
  return path.resolve(location.moduleDir);
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
