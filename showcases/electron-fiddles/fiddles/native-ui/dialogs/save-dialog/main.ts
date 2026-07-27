import { LynxWindow, app, dialog } from '@lynx-js/lynxtron';
import path from 'node:path';

// electron save-dialog main: ipcMain.handle('save-dialog') → showSaveDialog.
const setupWindow = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'save-dialog') {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save an Image',
        filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }],
      });
      callback.sendReply(canceled ? null : (filePath ?? null));
    }
  });
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Save Dialog",
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
