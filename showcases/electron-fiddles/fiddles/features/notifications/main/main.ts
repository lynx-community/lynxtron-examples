import { LynxWindow, app, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

import { Notification } from '@lynxtron-examples/fiddle-kit/lynx-native';

// Port of electron docs/fiddles features/notifications/main — the Notification is
// constructed and shown in the MAIN process. Upstream fires it automatically on
// app-ready; here the UI requests it via bridge so the interaction is repeatable.
const NOTIFICATION_TITLE = 'Basic Notification';
const NOTIFICATION_BODY = 'Notification from the Main process';

function registerBridgeHandlers() {
  lynxBridge.handle('notification:show', () => {
    new Notification({
      title: NOTIFICATION_TITLE,
      body: NOTIFICATION_BODY,
    }).show();
    return true;
  });
}

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Notification (from Main)",
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
