import { LynxWindow, app, dialog, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// electron native-ui/dialogs/information-dialog main:
// lynxBridge.handle('open-information-dialog') → showMessageBox → return response index.
function registerBridgeHandlers() {
  lynxBridge.handle('open-information-dialog', async () => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Information',
      message: "This is an information dialog. Isn't it nice?",
      buttons: ['Yes', 'No'],
    });
    return response;
  });
}

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Information Dialog",
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
