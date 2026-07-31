import { LynxWindow, app } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

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

const setupWindow = (win: LynxWindow) => {
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

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "App Information",
};

/**
 * Create this fiddle's window. Exposed as a function rather than inlined
 * because several fiddles open additional windows of themselves (new-window,
 * dock menu), the same way upstream calls `new BrowserWindow()` again.
 */
function createWindow(): LynxWindow {
  const win = new LynxWindow({
    ...WINDOW_OPTIONS,
  } as any);
  setupWindow(win);
  attachDocsLinks(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  createWindow();
});
