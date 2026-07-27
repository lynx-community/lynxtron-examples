import { app, type LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// Port of electron docs/fiddles system/app-information main. Upstream only
// exposes app.getAppPath(); this Lynxtron port also gathers app.getName /
// getVersion and app.getPath(...) for common app + user directories, all in a
// single request/response so the UI can render one info table.
type AppInfo = {
  name: string;
  version: string;
  appPath: string;
  paths: Array<{ key: string; value: string }>;
};

// Common named paths supported by app.getPath in the Lynxtron main API.
const PATH_KEYS = [
  'home',
  'appData',
  'userData',
  'temp',
  'desktop',
  'documents',
  'downloads',
  'music',
  'pictures',
  'videos',
] as const;

function collectAppInfo(): AppInfo {
  const paths: Array<{ key: string; value: string }> = [];
  for (const key of PATH_KEYS) {
    try {
      paths.push({ key, value: app.getPath(key as any) });
    } catch {
      // Skip any path not resolvable on this platform.
      paths.push({ key, value: '(unavailable)' });
    }
  }
  return {
    name: app.getName(),
    version: app.getVersion(),
    appPath: typeof (app as any).getAppPath === 'function' ? (app as any).getAppPath() : '(unavailable)',
    paths,
  };
}

export const registerMain: RegisterMain = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'app:getInfo') {
      try {
        callback.sendReply(collectAppInfo());
      } catch (err) {
        console.error('[app-information] collectAppInfo failed:', err);
        callback.sendReply({ name: 'error', version: String((err as Error)?.message ?? err), appPath: '', paths: [] });
      }
    }
  });
};
