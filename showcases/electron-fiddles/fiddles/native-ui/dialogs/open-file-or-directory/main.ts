import { LynxWindow, app, dialog, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// electron docs/fiddles native-ui/dialogs/open-file-or-directory main:
// lynxBridge.handle('dialog:openFileOrDirectory') → showOpenDialog({ properties: ['openFile','openDirectory'] }) → filePaths.
function registerBridgeHandlers() {
  lynxBridge.handle('dialog:openFileOrDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile', 'openDirectory'],
    });
    return canceled ? [] : filePaths;
  });
}

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
  attachDocsLinks(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  registerBridgeHandlers();
  createWindow();
});
