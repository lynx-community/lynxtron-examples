import { LynxWindow, app, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// Port of electron docs/fiddles windows/manage-windows/frameless-window.
//
// Upstream: the renderer sends a `create-frameless-window` IPC message and main
// does `new BrowserWindow({ frame: false }); win.loadURL(url)` — a window with
// no OS chrome (title bar / borders) loading a data: URL.
// Lynxtron windows render Lynx bundles rather than arbitrary web URLs, so
// instead of loading a data URL we open a second top-level LynxWindow via
// `createWindow()`. That fiddle is registered with
// `window: { frame: false }`, so this fiddle's main.ts constructs it as a genuinely
// frameless `new LynxWindow({ frame: false })` — the same window-creation the
// main process owns in Electron. We push a confirmation back to the UI.
let mainWindow: LynxWindow | null = null;

function registerBridgeHandlers() {
  lynxBridge.on('create-frameless-window', () => {
    createWindow();
    mainWindow?.sendGlobalEvent('frameless-window-opened', {});
  });
}

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Frameless Window",
  frame: false,
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
