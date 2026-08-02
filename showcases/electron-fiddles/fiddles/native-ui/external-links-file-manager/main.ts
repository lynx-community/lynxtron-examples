import { LynxWindow, app, shell, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// electron native-ui/external-links-file-manager main:
//   ipcMain.on('open-home-dir')  → shell.showItemInFolder(os.homedir())
//   ipcMain.on('open-external')  → shell.openExternal(url)
function registerBridgeHandlers() {
  lynxBridge.on('shell:showHome', () => {
    shell.showItemInFolder(app.getPath('home'));
  });
  lynxBridge.on('shell:openExternal', (data) => {
    const url = (data as { url?: string })?.url;
    if (url) shell.openExternal(url);
  });
}

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "External Links & File Manager",
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
