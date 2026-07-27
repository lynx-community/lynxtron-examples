import { LynxWindow, app } from '@lynx-js/lynxtron';
import path from 'node:path';

import { Notification } from '@lynxtron-examples/fiddle-kit/lynx-native';

// Port of electron docs/fiddles native-ui/notifications. Upstream fired the
// HTML5 `window.Notification` from the renderer; Lynx has no such API, so the
// UI bridges into main, which shows a real OS notification via Lynxtron's
// `Notification` (Electron-compatible).
const setupWindow = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name, data) => {
    if (name === 'show-notification') {
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
      callback.sendReply(opts.title);
    }
  });
};

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
  setupWindow(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  createWindow();
});
