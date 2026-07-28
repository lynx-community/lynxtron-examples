import { LynxWindow, app } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// Port of electron docs/fiddles
// features/window-customization/custom-title-bar/starter-code.
//
// Upstream has no main-process logic beyond `new BrowserWindow({})`, and this
// fiddle declares no window options at all, so it gets the platform default
// chrome. The handler below only reports the resulting window state back to the
// UI so the baseline is observable rather than asserted.
const setupWindow = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name) => {
    if (name !== 'window:describeChrome') return;
    const safe = <T,>(fn: () => T, fallback: T): T => {
      try {
        return fn();
      } catch {
        return fallback;
      }
    };
    const b = safe(() => win.getBounds(), undefined as any);
    callback.sendReply({
      platform: process.platform,
      frame: 'default (not overridden)',
      titleBarStyle: 'default (not overridden)',
      title: safe(() => win.getTitle(), '(unavailable)'),
      resizable: String(safe(() => win.isResizable(), '(unavailable)')),
      bounds: b ? `${b.width}×${b.height} @ (${b.x}, ${b.y})` : '(unavailable)',
    });
  });
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Starter Code (default chrome)",
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
