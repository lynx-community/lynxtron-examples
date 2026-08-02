import { LynxWindow, app, clipboard, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// electron docs/fiddles system/clipboard/copy main:
// ipcMain.handle('clipboard:writeText') → clipboard.writeText(text).
function registerBridgeHandlers() {
  lynxBridge.handle('clipboard:writeText', (_event, data) => {
    const text = typeof data === 'string' ? data : String(data ?? '');
    clipboard.writeText(text);
    return text;
  });
}

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Clipboard: Copy",
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
