import { LynxWindow, app, dialog, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// electron save-dialog main: lynxBridge.handle('save-dialog') → showSaveDialog.
function registerBridgeHandlers() {
  lynxBridge.handle('save-dialog', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save an Image',
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }],
    });
    return canceled ? null : (filePath ?? null);
  });
}

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
  attachDocsLinks(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  registerBridgeHandlers();
  createWindow();
});
