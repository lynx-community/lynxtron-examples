import { LynxWindow, app, dialog } from '@lynx-js/lynxtron';
import path from 'node:path';

// electron docs/fiddles native-ui/dialogs/open-file-or-directory main:
// ipcMain.handle('open-file-dialog') → showOpenDialog({ properties: ['openFile','openDirectory'] }) → filePaths.
const setupWindow = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'dialog:openFileOrDirectory') {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile', 'openDirectory'],
      });
      callback.sendReply(canceled ? [] : filePaths);
    }
  });
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Open File or Directory",
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
