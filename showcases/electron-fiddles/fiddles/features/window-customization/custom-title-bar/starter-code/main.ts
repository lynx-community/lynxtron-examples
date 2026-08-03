import { LynxWindow, app, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// Port of electron docs/fiddles
// features/window-customization/custom-title-bar/starter-code.
//
// Upstream has no main-process logic beyond `new BrowserWindow({})`, and this
// fiddle declares no window options at all, so it gets the platform default
// chrome. The handler below only reports the resulting window state back to the
// UI so the baseline is observable rather than asserted.
let mainWindow: LynxWindow | null = null;

function registerBridgeHandlers() {
  lynxBridge.handle('window:describeChrome', () => {
    const safe = <T,>(fn: () => T, fallback: T): T => {
      try {
        return fn();
      } catch {
        return fallback;
      }
    };
    const b = safe(() => mainWindow?.getBounds(), undefined as any);
    return {
      platform: process.platform,
      frame: 'default (not overridden)',
      titleBarStyle: 'default (not overridden)',
      title: safe(() => mainWindow?.getTitle(), '(unavailable)'),
      resizable: String(safe(() => mainWindow?.isResizable(), '(unavailable)')),
      bounds: b ? `${b.width}×${b.height} @ (${b.x}, ${b.y})` : '(unavailable)',
    };
  });
}

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
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  attachDocsLinks(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  registerBridgeHandlers();
  createWindow();
});
