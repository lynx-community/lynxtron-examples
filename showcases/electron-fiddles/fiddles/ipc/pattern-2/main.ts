import { LynxWindow, app, dialog } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// electron ipc/pattern-2 main: ipcMain.handle('dialog:openFile') → showOpenDialog.
const setupWindow = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'dialog:openFile') {
      const { canceled, filePaths } = await dialog.showOpenDialog({});
      callback.sendReply(canceled ? null : filePaths[0]);
    }
  });
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "IPC: Renderer ↔ Main (two-way)",
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
