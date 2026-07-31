import { LynxWindow, app, dialog } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// electron docs/fiddles native-ui/dialogs/error-dialog main:
// ipcMain.on('open-error-dialog') → dialog.showErrorBox(...).
const setupWindow = (win: LynxWindow) => {
  win.on('-lynx-message', (name: string) => {
    if (name === 'open-error-dialog') {
      dialog.showErrorBox('An Error Message', 'Demonstrating an error message.');
    }
  });
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Error Dialog",
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
