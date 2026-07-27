import { LynxWindow, app, clipboard } from '@lynx-js/lynxtron';
import path from 'node:path';

// Port of electron docs/fiddles system/clipboard/paste main:
// ipcMain.handle('clipboard:readText')  → clipboard.readText()
// ipcMain.handle('clipboard:writeText') → clipboard.writeText(text)
const setupWindow = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name, data) => {
    if (name === 'clipboard:readText') {
      callback.sendReply(clipboard.readText());
    } else if (name === 'clipboard:writeText') {
      const text = typeof data === 'string' ? data : String(data ?? '');
      clipboard.writeText(text);
      callback.sendReply(text);
    }
  });
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Clipboard: Paste",
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
