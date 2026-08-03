import { LynxWindow, app, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

import { Notification } from '@lynxtron-examples/fiddle-kit/lynx-native';

// Port of electron docs/fiddles native-ui/notifications. Upstream fired the
// HTML5 `window.Notification` from the renderer; Lynx has no such API, so the
// UI bridges into main, which shows a real OS notification via Lynxtron's
// `Notification` (Electron-compatible).
function registerBridgeHandlers() {
  lynxBridge.handle('show-notification', (_event, data) => {
    const kind = (data as { kind?: string } | undefined)?.kind;
    const opts =
      kind === 'advanced'
        ? {
            title: 'Notification with subtitle',
            subtitle: 'A custom subtitle',
            body: 'Short message plus a subtitle line',
          }
        : {
            title: 'Basic Notification',
            body: 'Short message part',
          };
    new Notification(opts).show();
    return opts.title;
  });
}

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Notifications",
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
  attachDocsLinks(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  registerBridgeHandlers();
  createWindow();
});
