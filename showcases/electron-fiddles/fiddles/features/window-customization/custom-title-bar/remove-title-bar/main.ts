import { LynxWindow, app, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// Port of electron docs/fiddles features/window-customization/custom-title-bar/
// remove-title-bar.
//
// Upstream is a one-liner: it opens a BrowserWindow with `titleBarStyle:
// 'hidden'` so the OS title bar is not drawn. In this showcase this fiddle's main.ts
// already creates the fiddle window with `{ titleBarStyle: 'hidden' }`, so main
// does NOT re-apply it. Instead we expose a small request/response surface so
// the UI can prove the window is fully functional without a native title bar:
// it reads the current bounds and lets the user re-title the window (the title
// is still tracked internally even though no native bar renders it).
let mainWindow: LynxWindow | null = null;

const bounds = () => {
  try {
    const b = mainWindow?.getBounds();
    if (!b) return '(unavailable)';
    return `${b.width}×${b.height} @ (${b.x}, ${b.y})`;
  } catch {
    return '(unavailable)';
  }
};

function registerBridgeHandlers() {
  lynxBridge.handle('window:getBounds', () => bounds());
  lynxBridge.handle('window:setTitle', (_event, data) => {
    const title = String((data as { title?: unknown } | undefined)?.title ?? '');
    try {
      mainWindow?.setTitle(title);
      return true;
    } catch {
      return false;
    }
  });
}

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Remove Title Bar",
  titleBarStyle: 'hidden',
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
