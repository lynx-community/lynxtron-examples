import { LynxWindow, app, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// electron ipc/pattern-1 main: ipcMain.on('set-title') → win.setTitle().
let mainWindow: LynxWindow | null = null;

function registerBridgeHandlers() {
  lynxBridge.on('set-title', (data) => {
    const title = String((data as Record<string, unknown>)?.title ?? '');
    mainWindow?.setTitle(title);
  });
}

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "IPC: Renderer → Main (one-way)",
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
