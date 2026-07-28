import { LynxWindow, app } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

import { Notification } from '@lynxtron-examples/fiddle-kit/lynx-native';

// Port of electron docs/fiddles features/notifications/renderer.
// Upstream builds the notification with the renderer's Web `Notification` API and
// updates the page text from its `onclick`. Lynx has no DOM Notification, so the
// request is bridged into the MAIN process, which constructs the OS Notification.
// If a notification `click` event is available it is pushed back to the UI so the
// upstream "click to see the effect in this interface" behavior is preserved.
const NOTIFICATION_TITLE = 'Title';
const NOTIFICATION_BODY = 'Notification from the UI. Click it to log to the interface.';

const setupWindow = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'notification:showFromRenderer') {
      const notification = new Notification({
        title: NOTIFICATION_TITLE,
        body: NOTIFICATION_BODY,
      });

      // Best-effort: mirror the renderer `onclick` by pushing the click back to
      // the UI. Not part of the confirmed API surface, so guard it.
      try {
        (notification as unknown as {
          on?: (event: string, cb: () => void) => void;
        }).on?.('click', () => {
          win.sendGlobalEvent('notification-clicked', 'Notification clicked!');
        });
      } catch {
        // Ignore — the button-triggered notification still shows.
      }

      notification.show();
      callback.sendReply(true);
    }
  });
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Notification (from Renderer)",
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
